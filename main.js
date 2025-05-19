const { remakeContent, readCSVFile, savePrompt } = require('./methods');

// 主函数
async function main() {
    try {
        // 读取CSV文件
        let csvStr1 = readCSVFile('data1.csv');
        let csvStr2 = readCSVFile('data2.csv');
        
        if (!csvStr1 || !csvStr2) {
            console.error('错误: 一个或两个CSV文件为空');
            return;
        }
        const [header1, ...rest1] = csvStr1.split('\n');
        const [header2, ...rest2] = csvStr2.split('\n');
        
        console.log('文件读取成功，开始匹配数据...');
        
        // 执行匹配并获取到新的csv内容
        const [content1, content2] = remakeContent(rest1, rest2);

        console.log('--------- [1] ---------');
        csvStr1 = `${header1}\n${content1}`
        console.log(csvStr1);
        console.log('--------- [2] ---------');
        csvStr2 = `${header2}\n${content2}`
        console.log(csvStr2);
        savePrompt(csvStr1, csvStr2)
    
    } catch (error) {
        console.error('程序运行出错:', error.message);
        process.exit(1);
    }
}

// 执行主函数
main();