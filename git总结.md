# git merge和git rebase的区别
>参考（https://dingjingmaster.github.io/2022/05/0002-rebase%E4%B8%8Emerge%E7%9A%84%E5%8C%BA%E5%88%AB/#comments）

从 master 拉一个叫feature的分支出来，

![](https://img2023.cnblogs.com/blog/2229336/202302/2229336-20230212212632543-172414776.png)

在 feature 分支进行了两次提交，此时其它人也进行了两次提交，并且合并到了 master 分支，

![](https://img2023.cnblogs.com/blog/2229336/202302/2229336-20230212212639166-1738345736.png)

此时是无法push到远程仓库的，需要进行分支合并，下面来演示git rebase 和 git merge 这两个命令的差异。
## 1. git merge
```bash
git checkout feature
git pull origin master  # 相当于git fetch origin master + git merge origin/master feature
```
git merge命令会在feature分支创建一个新的“合并的提交”(merge commit)，现有的分支不会以任何方式改变。
![](https://img2023.cnblogs.com/blog/2229336/202302/2229336-20230212212646868-1901748053.png)
这意味着每次合并上游（upstream）更改时，feature分支将有一个多余的合并提交。如果master分支更新频繁，这可能会导致feature分支历史记录有大量的合并提交记录。
## 2. git rebase
```bash
git checkout feature
git pull --rebase origin master # 相当于git fetch origin master + git rebase master

```
> rebase是变基，上面的命令是先将当前位置定位到feature分支上，再将feature分支变基为master分支，因此是将feature上的内容新添加到master分支的尾端。

此命令将整个 feature 分支移动到 master 分支的顶端，有效地将所有新提交合并到master 分支中。和git merge不同的是，git rebase通过为原始分支中的每个提交创建全新的提交来重写历史记录。
![](https://img2023.cnblogs.com/blog/2229336/202302/2229336-20230212212655904-34195404.png)
rebase的主要好处就是历史记录更清晰，没有不必要的合并提交，没有任何分叉。
