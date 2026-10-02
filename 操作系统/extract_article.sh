#!/bin/bash
# ATA文章提取脚本
# 用法: ./extract_article.sh [文章URL] [输出目录]

ARTICLE_URL="${1:-https://ata.atatech.org/articles/11000192093}"
OUTPUT_DIR="${2:-/Users/qiuhb/Project/Blogs/操作系统}"
IMAGES_DIR="$OUTPUT_DIR/images"

# 创建目录
mkdir -p "$IMAGES_DIR"

echo "=== ATA文章提取工具 ==="
echo "文章URL: $ARTICLE_URL"
echo "输出目录: $OUTPUT_DIR"
echo ""

# 检查是否提供了文章数据文件
if [ -f "$OUTPUT_DIR/article_data.json" ]; then
    echo "找到文章数据文件，开始处理..."
    
    # 提取图片URL并下载
    echo "下载图片..."
    python3 << PYTHON
import json
import os
import subprocess

with open('$OUTPUT_DIR/article_data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

images = data.get('images', [])
images_dir = '$IMAGES_DIR'

for i, img_url in enumerate(images):
    if 'oss-ata.alibaba.com/article' in img_url:
        # 提取文件名
        filename = img_url.split('/')[-1].split('?')[0]
        if not filename.endswith(('.png', '.jpg', '.jpeg', '.gif', '.webp')):
            filename = f"image_{i+1}.png"
        
        output_path = os.path.join(images_dir, filename)
        print(f"下载: {img_url} -> {output_path}")
        
        # 使用curl下载
        result = subprocess.run([
            'curl', '-L', '-o', output_path, img_url,
            '-H', 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        ], capture_output=True, text=True)
        
        if result.returncode == 0:
            print(f"  ✓ 成功")
        else:
            print(f"  ✗ 失败: {result.stderr}")

print("图片下载完成")
PYTHON

    # 生成markdown文件
    echo "生成markdown文件..."
    python3 << PYTHON
import json
import os
from datetime import datetime

with open('$OUTPUT_DIR/article_data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

title = data.get('title', '无标题')
author = data.get('author', '未知')
publish_time = data.get('publishTime', '未知')
view_count = data.get('viewCount', '未知')
content = data.get('content', '')
images = data.get('images', [])

# 构建markdown内容
md_content = f"""# {title}

**作者：** {author}  
**发表时间：** {publish_time}  
**浏览次数：** {view_count}

---

{content}

---

*本文档由ATA文章提取工具自动生成*  
*生成时间：{datetime.now().strftime("%Y-%m-%d %H:%M:%S")}*
"""

# 保存markdown文件
output_file = os.path.join('$OUTPUT_DIR', f"{title.replace(' ', '_').replace('/', '_')}.md")
with open(output_file, 'w', encoding='utf-8') as f:
    f.write(md_content)

print(f"Markdown文件已保存: {output_file}")
PYTHON

    echo ""
    echo "=== 提取完成 ==="
    echo "文件保存在: $OUTPUT_DIR"
    ls -la "$OUTPUT_DIR"
    
else
    echo "错误: 未找到文章数据文件 $OUTPUT_DIR/article_data.json"
    echo ""
    echo "请先提供文章数据，格式如下:"
    cat << 'JSON_EXAMPLE'
{
  "title": "文章标题",
  "author": "作者名称",
  "publishTime": "2024-01-01",
  "viewCount": "1000",
  "content": "文章内容（支持markdown）",
  "images": [
    "https://oss-ata.alibaba.com/article/xxx.png"
  ]
}
JSON_EXAMPLE
    exit 1
fi
