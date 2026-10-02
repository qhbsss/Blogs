// ATA文章提取脚本
// 使用方法：在浏览器控制台中运行此脚本

(function() {
    // 提取文章元信息
    function extractMetaInfo() {
        const title = document.querySelector('h1.article-title, .article-title, h1')?.textContent?.trim() || '';
        const author = document.querySelector('.author-name, .article-author, [data-author]')?.textContent?.trim() || '';
        const publishTime = document.querySelector('.publish-time, .article-time, time')?.textContent?.trim() || '';
        const viewCount = document.querySelector('.view-count, .article-views, [data-views]')?.textContent?.trim() || '';
        
        return {
            title,
            author,
            publishTime,
            viewCount
        };
    }

    // 提取文章内容
    function extractContent() {
        // 尝试多种可能的内容容器
        const selectors = [
            '.article-content',
            '.article-body',
            '.content-body',
            '.markdown-body',
            'article',
            '.post-content',
            '#article-content'
        ];
        
        for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element) {
                return element.innerHTML;
            }
        }
        
        // 如果找不到特定容器，尝试获取主要内容区域
        const mainContent = document.querySelector('main') || document.querySelector('.main-content');
        if (mainContent) {
            return mainContent.innerHTML;
        }
        
        return '';
    }

    // 提取所有ATA图片URL
    function extractImages() {
        const images = Array.from(document.querySelectorAll('img'))
            .map(img => ({
                src: img.src,
                alt: img.alt || '',
                isATA: img.src.includes('oss-ata.alibaba.com/article')
            }))
            .filter(img => img.src && img.src.length > 0);
        
        // 去重
        const uniqueImages = [];
        const seen = new Set();
        for (const img of images) {
            if (!seen.has(img.src)) {
                seen.add(img.src);
                uniqueImages.push(img);
            }
        }
        
        return uniqueImages;
    }

    // 将HTML转换为Markdown
    function htmlToMarkdown(html, images) {
        let markdown = html;
        
        // 替换图片标签为Markdown格式
        images.forEach((img, index) => {
            if (img.isATA) {
                const filename = `image_${String(index + 1).padStart(2, '0')}.png`;
                const markdownImg = `![${img.alt}](images/${filename})`;
                // 替换所有该图片的引用
                const regex = new RegExp(`<img[^>]*src=["']${img.src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*>`, 'gi');
                markdown = markdown.replace(regex, markdownImg);
            }
        });
        
        // 简单的HTML到Markdown转换
        markdown = markdown
            .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n')
            .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n')
            .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n')
            .replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n\n')
            .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
            .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
            .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
            .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
            .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
            .replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`')
            .replace(/<pre[^>]*>(.*?)<\/pre>/gi, '```\n$1\n```\n')
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<[^>]+>/g, '');
        
        return markdown;
    }

    // 主函数
    function main() {
        console.log('开始提取ATA文章内容...');
        
        const meta = extractMetaInfo();
        const content = extractContent();
        const images = extractImages();
        
        console.log('\n=== 文章元信息 ===');
        console.log('标题:', meta.title);
        console.log('作者:', meta.author);
        console.log('发表时间:', meta.publishTime);
        console.log('浏览次数:', meta.viewCount);
        
        console.log('\n=== 图片列表 ===');
        images.forEach((img, index) => {
            console.log(`${index + 1}. ${img.isATA ? '[ATA]' : '[其他]'} ${img.src}`);
        });
        
        // 生成Markdown
        const markdownContent = htmlToMarkdown(content, images);
        
        const fullMarkdown = `# ${meta.title}

**作者：** ${meta.author}  
**发表时间：** ${meta.publishTime}  
**浏览次数：** ${meta.viewCount}

---

${markdownContent}
`;
        
        console.log('\n=== Markdown内容预览（前500字符）===');
        console.log(fullMarkdown.substring(0, 500) + '...');
        
        // 复制到剪贴板
        const textarea = document.createElement('textarea');
        textarea.value = fullMarkdown;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        
        console.log('\n✅ Markdown内容已复制到剪贴板！');
        
        // 返回数据供下载
        return {
            meta,
            images,
            markdown: fullMarkdown
        };
    }

    // 运行
    return main();
})();
