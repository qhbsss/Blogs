---
title: "Arthas——码农的才思与浪漫"
source: "https://ata.atatech.org/articles/11000064234?spm=ata.23639420.0.0.15527536rfYjNO"
author:
published:
created: 2026-08-05
description:
tags:
  - "clippings"
---
CAINIAO









## 一、 Arthas

Arthas是什么？

Arthas是一个在线诊断工具。怎么理解，我们来看看Arthas的作用。

如果想在线上debug一个方法或者想看方法的返回，不需要申请线上debug，不需要重新加日志重新发布，直接watch指定的函数就可以看到调用结果。

如果CPU使用非常高，不需要top -H，再jstack，直接 thread -n就可以显示cpu使用最高的线程。

如果方法rt很高，不需要加日志打印方法耗时，直接trace就可以看到方法中每一步的耗时。

更多使用方法可以查看 [Arthas wiki](http://gitlab.alibaba-inc.com/middleware-container/arthas/wikis/home) 。

有了Arthas，我们可以对线上应用运行的情况更全面和深入的把握，在调试和查找问题时更得心应手。

本文不局限于Arthas的使用方法，更关注于其实现方式，总的来说Arthas的实现还是比较复杂的，有别于我们经常接触的java web应用的实现方式，更偏向于JVM层面，所以理解上还是有一定的难度，同时也不得不佩服作者的才思敏捷。

## 二、 JVM - attach

本段内容参考自： [JVM Attach机制实现](http://lovestblog.cn/blog/2014/06/18/jvm-attach/)

## 1、Attach

Attach机制是什么？说简单点就是jvm提供一种jvm进程间通信的能力，能让一个进程传命令给另外一个进程，并让它执行内部的一些操作，比如说我们为了让另外一个jvm进程把线程dump出来，那么我们跑了一个jstack的进程，然后传了个pid的参数，告诉它要哪个进程进行线程dump，既然是两个进程，那肯定涉及到进程间通信，以及传输协议的定义，比如要执行什么操作，传了什么参数等。

## 2、Attach的JVM实现

Attach对应的JVM实现在(AttachListener.cpp)，如下：

```java
static AttachOperationFunctionInfo funcs[] = {
    { "agentProperties",  get_agent_properties },
    { "datadump",         data_dump },
    { "dumpheap",         dump_heap },
    { "load",             JvmtiExport::load_agent_library },
    { "properties",       get_system_properties }，
    { "threaddump",       thread_dump },
    { "inspectheap",      heap_inspection },
    { "setflag",          set_flag },
    { "printflag",        print_flag },
    { "jcmd",             jcmd },
    { NULL,               NULL }
};
```

从代码中可以看出，attach主要实现的功能有：内存dump，线程dump，类信息统计(比如加载的类及大小以及实例个数等)，动态加载agent(使用过btrace的应该不陌生)，动态设置vm flag(但是并不是所有的flag都可以设置的，因为有些flag是在jvm启动过程中使用的，是一次性的)，打印vm flag，获取系统属性等。

### 2.1 Attach Listener线程的创建

默认情况下Attach Listener线程不会在JVM启动的时候就被创建（也可以通过参数指定在启动时创建），那么默认情况下Attach Listener是什么时候被创建的呢，这就要关注另外一个线程“Signal Dispatcher”，这个线程在JVM启动的时候就会被创建出来。

下面以jstack的实现来说明Attach Listener是如何被创建的，jstack命令的实现在Jstack.java，它属于JVMTI工具箱。

```java
private static void runThreadDump(String pid, String args[]) throws Exception {
    VirtualMachine vm = null;
    try {
        vm = VirtualMachine.Attach(pid);
    } catch (Exception x) {
        String msg = x.getMessage();
        if (msg != null) {
            System.err.println(pid + ": " + msg);
        } else {
            x.printStackTrace();
        }
        if ((x instanceof AttachNotSupportedException) &&
            (loadSAClass() != null)) {
            System.err.println("The -F option can be used when the target " +
                "process is not responding");
        }
        System.exit(1);
    }

    // Cast to HotSpotVirtualMachine as this is implementation specific
    // method.
    InputStream in = ((HotSpotVirtualMachine)vm).remoteDataDump((Object[])args);

    // read to EOF and just print output
    byte b[] = new byte[256];
    int n;
    do {
        n = in.read(b);
        if (n > 0) {
            String s = new String(b, 0, n, "UTF-8");
            System.out.print(s);
        }
    } while (n > 0);
    in.close();
    vm.detach();
}
```

请注意VirtualMachine.Attach(pid);这行代码，触发Attach pid的关键，如果是在linux下会走到下面的构造函数。

LinuxVirtualMachine(AttachProvider provider, String vmid)
    throws AttachNotSupportedException, IOException
{
    super(provider, vmid);

    // This provider only understands pids
    int pid;
    try {
        pid = Integer.parseInt(vmid);
    } catch (NumberFormatException x) {
        throw new AttachNotSupportedException("Invalid process identifier");
    }

    // Find the socket file. If not found then we attempt to start the
    // Attach mechanism in the target VM by sending it a QUIT signal.
    // Then we attempt to find the socket file again.
    path = findSocketFile(pid);
    if (path == null) {
        File f = createAttachFile(pid);
        try {
            // On LinuxThreads each thread is a process and we don't have the
            // pid of the VMThread which has SIGQUIT unblocked. To workaround
            // this we get the pid of the "manager thread" that is created
            // by the first call to pthread_create. This is parent of all
            // threads (except the initial thread).
            if (isLinuxThreads) {
                int mpid;
                try {
                    mpid = getLinuxThreadsManager(pid);
                } catch (IOException x) {
                    throw new AttachNotSupportedException(x.getMessage());
                }
                assert(mpid >= 1);
                sendQuitToChildrenOf(mpid);
            } else {
                sendQuitTo(pid);
            }

            // give the target VM time to start the Attach mechanism
            int i = 0;
            long delay = 200;
            int retries = (int)(AttachTimeout() / delay);
            do {
                try {
                    Thread.sleep(delay);
                } catch (InterruptedException x) { }
                path = findSocketFile(pid);
                i++;
            } while (i <= retries && path == null);
            if (path == null) {
                throw new AttachNotSupportedException(
                    "Unable to open socket file: target process not responding " +
                    "or HotSpot VM not loaded");
            }
        } finally {
            f.delete();
        }
    }

    // Check that the file owner/permission to avoid Attaching to
    // bogus process
    checkPermissions(path);

    // Check that we can connect to the process
    // - this ensures we throw the permission denied error now rather than
    // later when we attempt to enqueue a command.
    int s = socket();
    try {
        connect(s, path);
    } finally {
        close(s);
    }
}
```

```

下面是Signal Dispatcher线程的entry实现：

```java

```
static void signal_thread_entry(JavaThread* thread, TRAPS) {
      os::set_priority(thread, NearMaxPriority);
      while (true) {
      int sig;
      {
           // FIXME : Currently we have not decieded what should be the status
           // for this java thread blocked here. Once we decide about
           // that we should fix this.
           sig = os::signal_wait();
      }
      if (sig == os::sigexitnum_pd()) {
           // Terminate the signal thread
           return;
      }

      switch (sig) {
          case SIGBREAK: {
            // Check if the signal is a trigger to start the Attach Listener - in that
            // case don't print stack traces.
            if (!DisableAttachMechanism && AttachListener::is_init_trigger()) {
              continue;
            }
            // Print stack traces
            // Any SIGBREAK operations added here should make sure to flush
            // the output stream (e.g. tty->flush()) after output.  See 4803766.
            // Each module also prints an extra carriage return after its output.
            VM_PrintThreads op;
            VMThread::execute(&op);
            VM_PrintJNI jni_op;
            VMThread::execute(&jni_op);
            VM_FindDeadlocks op1(tty);
            VMThread::execute(&op1);
            Universe::print_heap_at_SIGBREAK();
            if (PrintClassHistogram) {
              VM_GC_HeapInspection op1(gclog_or_tty, true /* force full GC before heap inspection */,
                                       true /* need_prologue */);
              VMThread::execute(&op1);
            }
            if (JvmtiExport::should_post_data_dump()) {
              JvmtiExport::post_data_dump();
            }
            break;
          }
```java
                // ....
          }
        }
    }
}

```

当信号是SIGBREAK(在jvm里做了#define，其实就是SIGQUIT)的时候，就会触发 AttachListener::is_init_trigger()的执行。

```java
bool AttachListener::is_init_trigger() {
  if (init_at_startup() || is_initialized()) {
    return false;               // initialized at startup or already initialized
  }
  char fn[PATH_MAX+1];
  sprintf(fn, ".Attach_pid%d", os::current_process_id());
  int ret;
  struct stat64 st;
  RESTARTABLE(::stat64(fn, &st), ret);
  if (ret == -1) {
    snprintf(fn, sizeof(fn), "%s/.Attach_pid%d",
             os::get_temp_directory(), os::current_process_id());
    RESTARTABLE(::stat64(fn, &st), ret);
  }
  if (ret == 0) {
    // simple check to avoid starting the Attach mechanism when
    // a bogus user creates the file
    if (st.st_uid == geteuid()) {
      init();
      return true;
    }
  }
  return false;
}
```

一开始会判断当前进程目录下是否有个.Attach_pid文件（前面提到了），如果没有就会在/tmp下创建一个/tmp/.Attach_pid，当那个文件的uid和自己的uid是一致的情况下（为了安全）再调用init方法。

```java
void AttachListener::init() {
  EXCEPTION_MARK;
  klassOop k = SystemDictionary::resolve_or_fail(vmSymbols::java_lang_Thread(), true, CHECK);
  instanceKlassHandle klass (THREAD, k);
  instanceHandle thread_oop = klass->allocate_instance_handle(CHECK);

  const char thread_name[] = "Attach Listener";
  Handle string = java_lang_String::create_from_str(thread_name, CHECK);

  // Initialize thread_oop to put it into the system threadGroup
  Handle thread_group (THREAD, Universe::system_thread_group());
  JavaValue result(T_VOID);
  JavaCalls::call_special(&result, thread_oop,
                       klass,
                       vmSymbols::object_initializer_name(),
                       vmSymbols::threadgroup_string_void_signature(),
                       thread_group,
                       string,
                       CHECK);

  KlassHandle group(THREAD, SystemDictionary::ThreadGroup_klass());
  JavaCalls::call_special(&result,
                        thread_group,
                        group,
                        vmSymbols::add_method_name(),
                        vmSymbols::thread_void_signature(),
                        thread_oop,             // ARG 1
                        CHECK);

  {
      MutexLocker mu(Threads_lock);
        JavaThread* listener_thread = new JavaThread(&Attach_listener_thread_entry);

    // Check that thread and osthread were created
    if (listener_thread == NULL || listener_thread->osthread() == NULL) {
      vm_exit_during_initialization("java.lang.OutOfMemoryError",
                                    "unable to create new native thread");
    }

    java_lang_Thread::set_thread(thread_oop(), listener_thread);
    java_lang_Thread::set_daemon(thread_oop());

    listener_thread->set_threadObj(thread_oop());
    Threads::add(listener_thread);
    Thread::start(listener_thread);
}
}
```

此时水落石出了，看到创建了一个线程，并且取名为Attach Listener。再看看其子类LinuxAttachListener的init方法。

```java
int LinuxAttachListener::init() {
      char path[UNIX_PATH_MAX];          // socket file
      char initial_path[UNIX_PATH_MAX];  // socket file during setup
      int listener;                      // listener socket (file descriptor)

      // register function to cleanup
      ::atexit(listener_cleanup);
      int n = snprintf(path, UNIX_PATH_MAX, "%s/.java_pid%d",
                       os::get_temp_directory(), os::current_process_id());
      if (n < (int)UNIX_PATH_MAX) {
        n = snprintf(initial_path, UNIX_PATH_MAX, "%s.tmp", path);
      }
      if (n >= (int)UNIX_PATH_MAX) {
        return -1;
      }

      // create the listener socket
      listener = ::socket(PF_UNIX, SOCK_STREAM, 0);
      if (listener == -1) {
        return -1;
      }

      // bind socket
      struct sockaddr_un addr;
      addr.sun_family = AF_UNIX;
      strcpy(addr.sun_path, initial_path);
      ::unlink(initial_path);
      int res = ::bind(listener, (struct sockaddr*)&addr, sizeof(addr));
      if (res == -1) {
        RESTARTABLE(::close(listener), res);
        return -1;
      }

      // put in listen mode, set permissions, and rename into place
      res = ::listen(listener, 5);
      if (res == 0) {
          RESTARTABLE(::chmod(initial_path, S_IREAD|S_IWRITE), res);
          if (res == 0) {
              res = ::rename(initial_path, path);
          }
      }
      if (res == -1) {
        RESTARTABLE(::close(listener), res);
        ::unlink(initial_path);
        return -1;
      }
      set_path(path);
      set_listener(listener);

      return 0;
    }
```

看到其创建了一个监听套接字，并创建了一个文件/tmp/.java_pid，这个文件就是客户端之前一直在轮询等待的文件，随着这个文件的生成，意味着Attach的过程圆满结束了。

### 2.2 Attach Listener接收请求

看看它的entry实现Attach_listener_thread_entry

```java
static void Attach_listener_thread_entry(JavaThread* thread, TRAPS) {
      os::set_priority(thread, NearMaxPriority);
      thread->record_stack_base_and_size();

      if (AttachListener::pd_init() != 0) {
        return;
      }
      AttachListener::set_initialized();

      for (;;) {
        AttachOperation* op = AttachListener::dequeue();
        if (op == NULL) {
          return;   // dequeue failed or shutdown
        }

    ResourceMark rm;
    bufferedStream st;
    jint res = JNI_OK;

    // handle special detachall operation
    if (strcmp(op->name(), AttachOperation::detachall_operation_name()) == 0) {
      AttachListener::detachall();
    } else {
      // find the function to dispatch too
      AttachOperationFunctionInfo* info = NULL;
      for (int i=0; funcs[i].name != NULL; i++) {
        const char* name = funcs[i].name;
        assert(strlen(name) <= AttachOperation::name_length_max, "operation <= name_length_max");
        if (strcmp(op->name(), name) == 0) {
          info = &(funcs[i]);
          break;
        }
      }

      // check for platform dependent Attach operation
      if (info == NULL) {
        info = AttachListener::pd_find_operation(op->name());
      }

      if (info != NULL) {
        // dispatch to the function that implements this operation
        res = (info->func)(op, &st);
      } else {
          st.print("Operation %s not recognized!", op->name());
        res = JNI_ERR;
      }
    }

    // operation complete - send result and output to client
    op->complete(res, &st);
  }
}
```

从代码来看就是从队列里不断取AttachOperation，然后找到请求命令对应的方法进行执行，比如我们一开始说的jstack命令，找到 { “threaddump”, thread_dump }的映射关系，然后执行thread_dump方法

再来看看其要调用的AttachListener::dequeue()，

```java
AttachOperation* AttachListener::dequeue() {
  JavaThread* thread = JavaThread::current();
  ThreadBlockInVM tbivm(thread);

  thread->set_suspend_equivalent();
  // cleared by handle_special_suspend_equivalent_condition() or
  // java_suspend_self() via check_and_wait_while_suspended()

  AttachOperation* op = LinuxAttachListener::dequeue();

  // were we externally suspended while we were waiting?
  thread->check_and_wait_while_suspended();

  return op;
}
```

最终调用的是LinuxAttachListener::dequeue()，

```c
LinuxAttachOperation* LinuxAttachListener::dequeue() {
  for (;;) {
    int s;

    // wait for client to connect
    struct sockaddr addr;
    socklen_t len = sizeof(addr);
    RESTARTABLE(::accept(listener(), &addr, &len), s);
    if (s == -1) {
      return NULL;      // log a warning?
    }

    // get the credentials of the peer and check the effective uid/guid
    // - check with jeff on this.
    struct ucred cred_info;
    socklen_t optlen = sizeof(cred_info);
    if (::getsockopt(s, SOL_SOCKET, SO_PEERCRED, (void*)&cred_info, &optlen) == -1) {
      int res;
      RESTARTABLE(::close(s), res);
      continue;
    }
    uid_t euid = geteuid();
    gid_t egid = getegid();

    if (cred_info.uid != euid || cred_info.gid != egid) {
      int res;
      RESTARTABLE(::close(s), res);
      continue;
    }

    // peer credential look okay so we read the request
    LinuxAttachOperation* op = read_request(s);
    if (op == NULL) {
      int res;
      RESTARTABLE(::close(s), res);
      continue;
    } else {
      return op;
    }
  }
}
```

## 三、 Agent & Instrumentation

本段内容参考自： [Java SE 6 新特性: Instrumentation 新功能](https://www.ibm.com/developerworks/cn/java/j-lo-jse61/)

使用 Instrumentation，开发者可以构建一个独立于应用程序的代理程序（Agent），用来监测和协助运行在 JVM 上的程序，甚至能够替换和修改某些类的定义。有了这样的功能，开发者就可以实现更为灵活的运行时虚拟机监控和 Java 类操作了，这样的特性实际上提供了一种虚拟机级别支持的 AOP 实现方式，使得开发者无需对 JDK 做任何升级和改动，就可以实现某些 AOP 的功能了。

在 Java SE 6 里面，instrumentation 包被赋予了更强大的功能：启动后的 instrument、本地代码（native code）instrument，以及动态改变 classpath 等等。通过 Java Tool API 中的 attach 方式，我们可以很方便地在运行过程中动态地设置加载代理类，以达到 instrumentation 的目的，意味着 Java 具有了更强的动态控制、解释能力，它使得 Java 语言变得更加灵活多变。

## 1、虚拟机启动后的动态 instrument

为了使用动态instrument，开发者需要编写一个含有“agentmain”函数的 Java 类：

public static void agentmain (String agentArgs, Instrumentation inst);          [1]
public static void agentmain (String agentArgs);              [2]

为了使用这个java类，开发者必须在 manifest 文件里面设置“Agent-Class”来指定包含 agentmain 函数的类。

为了将agentmain-agent的java类加入到已经启动后的虚拟机中，需要使用到前文介绍的Attach API。

Attach API 很简单，只有 2 个主要的类，都在 com.sun.tools.attach 包里面： VirtualMachine 代表一个 Java 虚拟机，也就是程序需要监控的目标虚拟机，提供了 JVM 枚举，Attach 动作和 Detach 动作（Attach 动作的相反行为，从 JVM 上面解除一个代理）等等; VirtualMachineDescriptor 则是一个描述虚拟机的容器类，配合 VirtualMachine 类完成各种功能。

## 2、agentmain-agent的具体实现

我们以一个简单的例子来看看如何利用instrument实现虚拟机启动之后的动态代码替换。

首先，我们有一个简单的类，TransClass， 可以通过一个静态方法返回一个整数 1。

```java
public class TransClass {
     public int getNumber() {
     return 1;
    }
}
```

然后写一个测试用例来加载TransClass：

```java
public class TestMainInJar {
public static void main(String[] args) throws InterruptedException {
        System.out.println(new TransClass().getNumber());
        int count = 0;
        while (true) {
            Thread.sleep(500);
            int number = new TransClass().getNumber();
            System.out.println(number);
        }
    }
 }
```

这个测试用例很简单，每隔500ms，打印出getNumber()的值，可以预见打印的值一直是“1”，现在我们想动态的将getNumber()方法进行替换，返回整数2，使其在虚拟机不停止的情况下打印的值变成“2”。

那么我们将 TransClass 的 getNumber 方法改成如下:

```java
public int getNumber() {
    return 2;
}
```

再将这个返回 2 的 Java 文件编译成类文件，为了区别开原有的返回 1 的类，我们将返回 2 的这个类文件命名为 TransClass2.class。

接下来，我们建立一个Transformer 类：

```java
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.lang.instrument.ClassFileTransformer;
import java.lang.instrument.IllegalClassFormatException;
import java.security.ProtectionDomain;

class Transformer implements ClassFileTransformer {
   public static final String classNumberReturns2 = "TransClass.class.2";

   public static byte[] getBytesFromFile(String fileName) {
       try {
           // precondition
           File file = new File(fileName);
           InputStream is = new FileInputStream(file);
           long length = file.length();
           byte[] bytes = new byte[(int) length];

           // Read in the bytes
           int offset = 0;
           int numRead = 0;
           while (offset <bytes.length
                   && (numRead = is.read(bytes, offset, bytes.length - offset)) >= 0) {
               offset += numRead;
           }

           if (offset < bytes.length) {
               throw new IOException("Could not completely read file " + file.getName());
                           }
               is.close();
               return bytes;
           } catch (Exception e) {
               System.out.println("error occurs in _ClassTransformer!"+ e.getClass().getName());
               return null;
           }
       }

       public byte[] transform(ClassLoader l, String className, Class<?> c,
               ProtectionDomain pd, byte[] b) throws IllegalClassFormatException {
           if (!className.equals("TransClass")) {
               return null;
           }
           return getBytesFromFile(classNumberReturns2);

       }
    }
```

这个类实现了 ClassFileTransformer 接口。其中，getBytesFromFile 方法根据文件名读入二进制字符流，而 ClassFileTransformer 当中规定的 transform 方法则完成了类定义的替换转换。

接着我们编写一个含有 agentmain 的 AgentMain 类：

```java
import java.lang.instrument.ClassDefinition;
import java.lang.instrument.Instrumentation;
import java.lang.instrument.UnmodifiableClassException;

public class AgentMain {
   public static void agentmain(String agentArgs, Instrumentation inst)
           throws ClassNotFoundException, UnmodifiableClassException,
           InterruptedException {
       inst.addTransformer(new Transformer (), true);
       inst.retransformClasses(TransClass2.class);
       System.out.println("Agent Main Done");
   }
}
```

addTransformer 方法并没有指明要转换哪个类。转换发生在 premain 函数执行之后，main 函数执行之前，这时每装载一个类，transform 方法就会执行一次，看看是否需要转换，所以，在 transform（Transformer 类中）方法中，程序用 className.equals("TransClass") 来判断当前的类是否需要转换。

然后把AgentMain类、Transformer类、TransClass2.class打成TestInstrument1.Jar包，并在Manifest指定agentmain方法所在的类，如下：

Manifest-Version: 1.0
Agent-Class: AgentMain

现在有了运行着测试用例TestMainInJar的虚拟机，有了准备替换的TestInstrument1.Jar，为了实现动态替换，需要将TestInstrument1.Jar attach到TestMainInJar虚拟机上。

import com.sun.tools.attach.VirtualMachine;
 import com.sun.tools.attach.VirtualMachineDescriptor;
 ……
```java
 // 一个运行 Attach API 的线程子类
 static class AttachThread extends Thread {

 private final List<VirtualMachineDescriptor> listBefore;

    private final String jar;

    AttachThread(String attachJar, List<VirtualMachineDescriptor> vms)   {
        listBefore = vms;  // 记录程序启动时的 VM 集合
        jar = attachJar;
    }

    public void run() {
        VirtualMachine vm = null;
        List<VirtualMachineDescriptor> listAfter = null;
        try {
            int count = 0;
            while (true) {
                listAfter = VirtualMachine.list();
                for (VirtualMachineDescriptor vmd : listAfter) {
                    if (!listBefore.contains(vmd)) {
                     // 如果 VM 有增加，我们就认为是被监控的 VM 启动了
                     // 这时，我们开始监控这个 VM
                            vm = VirtualMachine.attach(vmd);
                            break;
                        }
                    }
                    Thread.sleep(500);
                    count++;
                    if (null != vm || count >= 10) {
                        break;
                    }
                }
                vm.loadAgent(jar);
                vm.detach();
            } catch (Exception e) {
                 ignore
            }
        }
    }

 public static void main(String[] args) throws InterruptedException {
     new AttachThread("TestInstrument1.jar", VirtualMachine.list()).start();
 }
```

运行AttachThread::main，一段时间后会发现TestMainInJar打印出来的值会变成“2”。

注意：vm = VirtualMachine.attach(vmd); 这里就是将自己attach到运行的虚拟机上，而vm.loadAgent(jar); 则是通知attach上的虚拟机加载将指定的jar。

## 四、 Arthas的具体实现

知道了JVM-attach、Instrumentation 、Agent的实现原理，我们来看看Arthas的具体实现。

## 1、一切的开始

分析Arthas的启动脚本——as.sh，其启动的main函数为ArthasLauncher::main，其中主要实现在，

```java
private void attachAgent(Configure configure) throws Exception {
    final ClassLoader loader = Thread.currentThread().getContextClassLoader();
    final Class<?> vmdClass = loader.loadClass("com.sun.tools.attach.VirtualMachineDescriptor");
    final Class<?> vmClass = loader.loadClass("com.sun.tools.attach.VirtualMachine");

    Object attachVmdObj = null;
    for (Object obj : (List<?>) vmClass.getMethod("list", (Class<?>[]) null).invoke(null, (Object[]) null)) {
        if ((vmdClass.getMethod("id", (Class<?>[]) null).invoke(obj, (Object[]) null))
                .equals(Integer.toString(configure.getJavaPid()))) {
            attachVmdObj = obj;
        }
    }

    Object vmObj = null;
    try {
        if (null == attachVmdObj) { // 使用 attach(String pid) 这种方式
            vmObj = vmClass.getMethod("attach", String.class).invoke(null, "" + configure.getJavaPid());
        } else {
            vmObj = vmClass.getMethod("attach", vmdClass).invoke(null, attachVmdObj);
        }
        vmClass.getMethod("loadAgent", String.class, String.class).invoke(vmObj, configure.getArthasAgent(), configure.getArthasCore() + ";" + configure.toString());
    } finally {
        if (null != vmObj) {
            vmClass.getMethod("detach", (Class<?>[]) null).invoke(vmObj, (Object[]) null);
        }
    }
}
```

注意其中两行，vmObj = vmClass.getMethod("attach", vmdClass).invoke(null, attachVmdObj);
vmClass.getMethod("loadAgent", String.class, String.class).invoke(vmObj, configure.getArthasAgent(), configure.getArthasCore() + ";" + configure.toString());
```

至此已经一清二楚，Arthas在启动的时候会attach到指定pid的虚拟机上，并通知该虚拟机加载configure.getArthasAgent()，而configure.getArthasAgent()主要是com.taobao.arthas.agent.AgentLauncher。

```

查看com.taobao.arthas.agent.AgentLauncher的代码，果然它是一个Instrumentation的agent，有一个agentmain入口函数，一切的奥秘皆从此开始。

注意一点：com.taobao.arthas.agent.AgentLauncher是被目标java进程加载的，其代码是运行在目标java进程上，而不是Arthas本身的java进程上，明白这一点对后面的Arthas可以获取目标java进程的各种运行信息至关重要。

## 2、命令的处理

ArthasLauncher被目标虚拟机加载之后，主要总能有三个：
* 把Arthas所包含的jar包加入到目标java进程的BootstrapClassLoader中；
* 生成一个Arthas专用的classloader来加载Arthas类；
* 使用Arthas专用classloader来加载一些必须的类，其中最重要的是com.taobao.arthas.core.server.ArthasServer

Arthas支持远程调试，可以在远程服务器上启动Arthas，然后通过Arthas Console Client来远程调试目标服务器，com.taobao.arthas.core.server.ArthasServer就是来实现这个功能,在目标服务器上直接调试时相当于./as.sh [12356@127.0.0.1](mailto:12356@127.0.0.1):3658，这里我们不关心它的具体实现。

直接看ArthasServer::read，即接收命令之后的处理过程：

```java

```
private void doRead(final ByteBuffer byteBuffer, SelectionKey key) {
    final ArthasAttachment attachment = (ArthasAttachment) key.attachment();
    final SocketChannel socketChannel = (SocketChannel) key.channel();
    final Session session = attachment.getSession();
    try {
        ....
        while (byteBuffer.hasRemaining()) {
            switch (attachment.getLineDecodeState()) {
                case READ_CHAR: {
                   ...
                }
                case READ_EOL: {
                    final String line = attachment.clearAndGetLine(session.getCharset());
                    executorService.execute(new Runnable() {
                        @Override
                        public void run() {
                            // 会话只有未锁定的时候才能响应命令
                            if (session.tryLock()) {
                                try {
                                    // 命令执行
                                    boolean handled = false;
                                    for (CommandHandler handler: commandHandlerList) {
                                        if (handler.handleCommand(line, session)) {
                                            handled = true;
                                            break;
                                        }
                                    }
                                    ...
                                } catch (IOException e) {
                                    ...
                                } finally {
                                    session.unLock();
                                }
                            } else {
                                ...
                            }
                        }
                    });
             attachment.setLineDecodeState(LineDecodeState.READ_CHAR);
                    break;
                }
            }
        }//while for line decode
        byteBuffer.clear();
    }
    catch (IOException e) {
        ...
    }
}

命令的处理在CommandHandler.handleCommand(...)中，略过中间流程，直接来到AbstractCommandHandler::execute(...)，至此我们已经来到命令处理的核心入口，

protected void execute(final Session session, final Command command, final String cmd) throws ArthasExecuteException, IOException {
    // TODO 此处后续还可以优化，避免每次生成CommandPrinter对象
    final Command.Printer printer = new CommandPrinter(cmd, session);
    try {
        // 影响反馈
        final Affect affect;
        final Command.Action action = command.getAction();

        if (action instanceof Command.SilentAction) {
            // 无任何后续动作的动作
            affect = new Affect();
            ((Command.SilentAction) action).action(session, inst, printer);
        }
        else if (action instanceof Command.RowAction) {
            // 需要反馈行影响范围的动作
            affect = new RowAffect();
            final RowAffect rowAffect = ((Command.RowAction) action).action(session, inst, printer);
            ((RowAffect) affect).rCnt(rowAffect.rCnt());
        }
        else if (action instanceof Command.GetEnhancerAction) {
            // 需要做类增强的动作
            affect = new EnhancerAffect();

            // 执行命令动作 & 获取增强器
            final Command.GetEnhancer getEnhancer = ((Command.GetEnhancerAction) action).action(session, inst,
                                                                                                printer);
            final int lock = session.getLock();
            final AdviceListener listener = getEnhancer.getAdviceListener();
            final EnhancerAffect enhancerAffect = Enhancer.enhance(inst, lock, listener instanceof InvokeTraceable,
                                                                   getEnhancer.getClassNameMatcher(),
                                                                   getEnhancer.getMethodNameMatcher());

            // 这里做个补偿,如果在enhance期间,unLock被调用了,则补偿性放弃
            if (session.getLock() == lock) {
                // 注册通知监听器
                AdviceWeaver.reg(lock, listener);
                printer.println(ABORT_MSG);

                ((EnhancerAffect) affect).cCnt(enhancerAffect.cCnt());
                ((EnhancerAffect) affect).mCnt(enhancerAffect.mCnt());
                ((EnhancerAffect) affect).getClassDumpFiles().addAll(enhancerAffect.getClassDumpFiles());
            }
        }

        // 其他自定义动作
        else {
            // do nothing...
            affect = new Affect();
        }

        if (!(action instanceof Command.NonRespAction)) {
            // 记录下命令执行的执行信息
            printer.print(affect.toString() + "\n");
        }
    }

    // 命令执行错误必须纪录
    catch (Throwable t) {
        throw new ArthasExecuteException(format("execute failed. sessionId=%s", session.getSessionId()), t);
    }

    // 跑任务
    jobRunning(session, printer);
}

好啦，Arthas所支持的命令有三大类：
* 一类是纯观察JVM信息或者操作Arthas的命令如：VersionCommand、JvmCommand、QuitCommand；
* 一类是命令会对JVM或者类造成影响，需要进行记录，如：ThreadCommand、DumpClassCommand、JadCommand；
* 一类是需要对命令的目标进行代理增强，如：WatchCommand、TraceCommand。

下面会对一些有代表性的命令结合其用法来进行实现分析，了解原理，主要有JvmCommand、WatchCommand。

## 3、JvmCommand

JvmCommand对应的Arthas命令是“jvm”，其作用是查看当前JVM信息，包含jvm的启动参数、内存使用情况、gc的大概情况、线程信息等，具体可以查看Arthas的wiki。

之所以首先选择JvmCommand这个简单命令，是因为它向我们指出了一条通过java代码观察JVM全貌信息的途径——ManagementFactory。

ManagementFactory属于java.lang.management，java.lang.management提供了对内存（MemoryMXBean）、线程（ThreadMXBean）、运行时（RuntimeMXBean）、类加载（ClassLoadingMXBean）、GC（GarbageCollectorMXBean）等的统计和观察。

JvmCommand的实现很简单，主要是利用ManagementFactory打印出JVM的相关信息，具体的实现可以见其源码。

ThreadCommand也是采用了ManagementFactory来观察线程的详细信息。

## 4、WatchCommand

WatchCommand是一个比较重要和常用的命令，也是一个实现比较复杂和有代表性的命令，watch的主要用法是用于线上调试，其具体使用方式可以见Arthas的wiki。

在阅读WatchCommand和Arthas源代码之前，我们先自己想一想如何来实现类似的功能，似乎是无从下手的，这是一个很奇怪的事情，为什么我们自己的java进程可以精确的拦截到其他java进程的方法，并获取其调用信息。

结合之前的分析，现在我们已经有了一些眉目，是Arthas把自己的代码attach到目标java进程中，这样就可以在目标进程中动态加入了一些代码，再利用Instrumentation可以动态的改变特定java类实现的功能，来精确的拦截我们指定的类和方法。

我们再回到AbstractCommandHandler::execute(...)，只关注Command.GetEnhancerAction（WatchCommand属于GetEnhancerAction），

```java
protected void execute(final Session session, final Command command, final String cmd) throws ArthasExecuteException, IOException {
    //...
    try {
        //...
        if (action instanceof Command.SilentAction) {
            //...
        }
        else if (action instanceof Command.RowAction) {
            //...
        }
        else if (action instanceof Command.GetEnhancerAction) {
            // 需要做类增强的动作
            affect = new EnhancerAffect();

            // 执行命令动作 & 获取增强器
            final Command.GetEnhancer getEnhancer = ((Command.GetEnhancerAction) action).action(session, inst,
                                                                                                printer);
            final int lock = session.getLock();
            final AdviceListener listener = getEnhancer.getAdviceListener();
            final EnhancerAffect enhancerAffect = Enhancer.enhance(inst, lock, listener instanceof InvokeTraceable,
                                                                   getEnhancer.getClassNameMatcher(),
                                                                   getEnhancer.getMethodNameMatcher());

            // 这里做个补偿,如果在enhance期间,unLock被调用了,则补偿性放弃
            if (session.getLock() == lock) {
                // 注册通知监听器
                AdviceWeaver.reg(lock, listener);
                printer.println(ABORT_MSG);

                ((EnhancerAffect) affect).cCnt(enhancerAffect.cCnt());
                ((EnhancerAffect) affect).mCnt(enhancerAffect.mCnt());
                ((EnhancerAffect) affect).getClassDumpFiles().addAll(enhancerAffect.getClassDumpFiles());
            }
        }

        //...
    }
    catch (Throwable t) {
        //...
    }
    //..
}
```

GetEnhancerAction说明这个命令需要对观察的java类进行一定程度的增强，容易想到的就是AOP。

GetEnhancerAction处理的过程中，首先会获取Commond.action的GetEnhancer，GetEnhancer不重要，重要的是其getAdviceListener()，查看WatchCommand的getAdviceListener，它定义了before、afterReturning、afterThrowing、finishing等回调，对应于watch命令的“-b”、“-s”、“-e”、“-f”等选项，代表watch在观察方法调用时的打印时机。

有了打印回调方法，那这些方法怎么被调用的？奥秘在Enhancer中，Enhancer是ClassFileTransformer的子类，重写了transform(...)方法，transform中会对指定类进行增强。

final ClassReader cr;
cr.accept(new AdviceWeaver(adviceId, isTracing, cr.getClassName(), methodNameMatcher, affect, cw), EXPAND_FRAMES);

好啦，现在来到所有秘密的核心，由于使用了ASM，对ASM不熟悉的人还是很难理解的，我也是一知半解，只能从AdviceWeaver略知一二。

AdviceWeaver继承自ASM的ClassVisitor，其中有个方法visitMethod(...)，顾名思义，应该是对类方法进行处理，然后就是好大一坨的代码。

visitMethod返回了一个AdviceAdapter对象，而AdviceAdapter对象则实现了onMethodEnter、onMethodExit等方法，再次顾名思义应该是在方法调用前和调用之后让开发者有机会做一些处理，事实上Arthas也是在此将之前提到的WatchCommand的getAdviceListener注入进去，在方法调用前和完成之后，分别调用对应的adviceListener（before、afterReturning）。

AdviceWeaver的代码实在太过玄妙，ASM也不想花很多时间去研究，有对ASM比较熟悉的同学可以具体分析下。

### WatchCommand的问题

最后让我们来看看WatchCommand的观察表达式，WatchCommand提供类似条件断点的debug方式，为的是能根据特定条件来过滤非必须的请求。

WatchCommand的观察表达式是groovy的，所以只要是合法的groovy的表达是都可以被支持。

```java
class GroovyExpress implements Express {
    private final Binding bind;

    public GroovyExpress(Object object) {
        bind = new Binding();
        for (Field field : object.getClass().getDeclaredFields()) {
            try {
                bind.setVariable(field.getName(), readDeclaredField(object, field.getName(), true));
            } catch (IllegalAccessException e) {
            }
        }
    }

    @Override
    public Object get(String express) throws ExpressException {
        try {
            return new GroovyShell(bind).evaluate(express);
        } catch (Exception e) {
            throw new ExpressException(express, e);
        }
    }

    @Override
    public boolean is(String express) throws ExpressException {
        try {
            final Object ret = get(express);
            return null != ret && ret instanceof Boolean && (Boolean) ret;
        } catch (Throwable t) {
            return false;
        }
    }
}
```

但是java调用groovy会有fullgc的问题，而Arthas的groovy调用方式new GroovyShell(bind).evaluate(express)，并没有很好的解决这个问题，在高并发下频繁执行groovyShell最终会导致目标应用fullgc，所以在高并发应用下，最好设置合适的观察表达式，一旦命中尽快退出Arthas，再进行分析。

TraceCommand也是使用了和WatchCommand类似的实现，TraceCommand命令在查找高耗时方法的时候非常有用。

## 五、回顾&彩蛋

现在我们用一张图来回顾下Arthas的整个过程

![enter image description here](https://oss-ata.alibaba.com/article/2023/11/392360e1-456f-4a61-8dfb-012f76bf6a35.png?x-oss-process=image/resize,m_lfit,w_1600/auto-orient,1/quality,Q_80/format,avif/ignore-error,1)

enter image description here

在对Arthas进行抽丝剥茧的分析之后，我们发现其整个流程还是非常清晰的，先attach再loadagent，最终把自己注入到目标进程中，从而有了观察和修改目标进程的机会。

在Arthas的实现代码中有一段奇怪的代码：

```java
// don't ask why
if ($(cmd)) {
    WriteUtils.write(socketChannel, wrap($$()));
    WriteUtils.writePrompt(session);
    return true;
}
```

don't ask why！试试“july”命令吧！码农也是非常浪漫的！
