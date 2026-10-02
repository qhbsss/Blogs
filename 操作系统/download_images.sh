#!/bin/bash

# ATA文章图片下载脚本
# 使用方法：
# 1. 在浏览器控制台运行 extract_ata_article.js 获取图片URL
# 2. 将图片URL保存到 images.txt 文件（每行一个URL）
# 3. 运行此脚本下载图片

# 创建images目录
mkdir -p images

# 检查images.txt是否存在
if [ ! -f "images.txt" ]; then
    echo "错误：images.txt 文件不存在！"
    echo "请先在浏览器中提取图片URL并保存到 images.txt 文件中"
    exit 1
fi

# 下载图片
echo "开始下载图片..."
line_num=1
while IFS= read -r url; do
    if [ -n "$url" ]; then
        # 提取文件名
        filename=$(basename "$url" | cut -d'?' -f1)
        
        # 如果没有扩展名，添加.png
        if [[ ! "$filename" =~ \. ]]; then
            filename="${filename}.png"
        fi
        
        # 添加序号前缀
        output_name=$(printf "image_%02d_%s" "$line_num" "$filename")
        
        echo "下载: $url -> images/$output_name"
        curl -L -o "images/$output_name" "$url" --silent --fail
        
        if [ $? -eq 0 ]; then
            echo "  ✓ 成功"
        else
            echo "  ✗ 失败"
        fi
        
        ((line_num++))
    fi
done < "images.txt"

echo ""
echo "下载完成！图片保存在 images/ 目录中"
