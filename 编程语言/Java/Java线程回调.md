# 线程回调
## 概念解析
线程回调是一种异步编程模式,它通过将一个回调函数传递给另一个线程,从而在某个任务执行完毕后通知并返回结果给调用方线程。回调函数通常定义在调用方线程中,它会在任务执行完毕后被被另一个线程调用,并将执行结果作为参数传递给调用方线程。
## 实现方式
eg:
```java
package kun.thread;

public class THread 
{
	static C c=new C();
	//flag用来标志子线程执行结束
	static boolean flag=false;
	
	public static void main(String []arg)
	{	
		
		c.setvalue(12);
		System.out.println("子线程执行之前value的值是："+c.getvalue());	
		System.out.println("执行子线程");	
		
		
		Thread mythread = new MyThread(c);
		mythread.start();
		
		//等待子线程执行结束
		while(!flag);
		System.out.println("子线程执行之后value的值是："+c.getvalue());	
	}	

	public static void callback()
		{
			System.out.println("子线程执行结束");	
			flag=true;
		}
}


class C
{
	private int value=0;
	public int getvalue()
	{
		return value;
	}
	public void setvalue(int v)
	{
		this.value=v;
	}
}



class MyThread extends Thread
{
	public MyThread(C cc)
	{
		this.cc=cc;
	}
	private C cc;
	@Override
	public void run() 
	{
		cc.setvalue(20);			
		THread.callback();//很像C#的委托和事件
	}
}
```
