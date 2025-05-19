const fs = require('fs');
const path = require('path');

function remakeContent(arr1, arr2) {
    const rows1 = arr1.filter(row => row.trim() !== '');
    const rows2 = arr2.filter(row => row.trim() !== '');
    const results = [];
    
    // 首先尝试自动识别字段映射关系
    const fieldMapping = detectFieldMapping(rows1[0], rows2[0]);
    
    rows1.forEach((row1, i) => {
        const row1Data = row1.split(',');
        let bestMatch = { score: -1, index: -1, row: '' };
        
        rows2.forEach((row2, j) => {
            const row2Data = row2.split(',');
            const thisScore = getDynamicScore(row1Data, row2Data, fieldMapping);
            
            if (thisScore > bestMatch.score) {
                bestMatch = { score: thisScore, index: j, row: row2 };
            }
        });
        
        results.push({
            row1Index: i,
            row1: row1,
            bestMatch: bestMatch
        });
    });
    return getFinnalResults(results);
}

// 自动检测字段映射关系
function detectFieldMapping(row1, row2) {
    const arr1 = row1.split(',');
    const arr2 = row2.split(',');
    const mapping = {};
    
    // 尝试匹配明显的字段（如日期、ID等）
    arr1.forEach((val1, i) => {
        if (val1.trim() === '') return;
        
        // 尝试匹配日期格式
        if (isDate(val1)) {
            const dateIndex = arr2.findIndex(val2 => isDate(val2) && datesMatch(val1, val2));
            if (dateIndex >= 0) mapping[i] = dateIndex;
            return;
        }
        
        // 尝试匹配ID或代码（通常包含字母和数字）
        if (isLikelyId(val1)) {
            const idIndex = arr2.findIndex(val2 => val2 === val1);
            if (idIndex >= 0) mapping[i] = idIndex;
            return;
        }
        
        // 尝试匹配数值
        if (!isNaN(val1)) {
            const numIndex = arr2.findIndex(val2 => val2 === val1);
            if (numIndex >= 0) mapping[i] = numIndex;
        }
    });
    
    return mapping;
}

// 动态评分函数
function getDynamicScore(arr1, arr2, fieldMapping) {
    let score = 0;
    const usedIndices = new Set();
    
    // 首先使用已知的映射关系
    Object.entries(fieldMapping).forEach(([i1, i2]) => {
        if (arr1[i1] === arr2[i2]) {
            score += 20; // 已知映射的匹配权重更高
            usedIndices.add(i2);
        }
    });
    
    // 然后尝试匹配其他字段（避免重复匹配）
    arr1.forEach((val1, i1) => {
        if (fieldMapping[i1] !== undefined) return; // 已经匹配过
        
        arr2.forEach((val2, i2) => {
            if (usedIndices.has(i2)) return; // 这个字段已经匹配过
            
            if (val1 === val2) {
                score += 10;
                usedIndices.add(i2);
            } else if (isDate(val1) && isDate(val2) && datesMatch(val1, val2)) {
                score += 15; // 日期匹配权重较高
                usedIndices.add(i2);
            } else if (!isNaN(val1) && !isNaN(val2) && parseFloat(val1) === parseFloat(val2)) {
                score += 8; // 数值匹配
                usedIndices.add(i2);
            }
        });
    });
    
    return score;
}

// 辅助函数
function isDate(str) {
    return /\d{4}[\/-]\d{1,2}[\/-]\d{1,2}/.test(str);
}

function datesMatch(dateStr1, dateStr2) {
    // 简化日期匹配逻辑，实际应用可能需要更复杂的处理
    const d1 = dateStr1.replace(/[\/-]/g, '').split(' ')[0];
    const d2 = dateStr2.replace(/[\/-]/g, '').split(' ')[0];
    return d1 === d2;
}

function isLikelyId(str) {
    return /[A-Za-z].*[0-9]|[0-9].*[A-Za-z]/.test(str);
}

// 打印结果
function getFinnalResults(results) {
    let str1 = '';
    let str2 = '';
    results.forEach(result => {
        
        if (str1 != '') {
            str1 += '\n';
        }
        if (str2 != '') {
            str2 += '\n';
        }
        str1 += result.row1;
        str2 += result.bestMatch.row;
    });
    
    return [str1, str2];
}

// 从CSV文件读取数据的函数
function readCSVFile(filePath) {
    try {
        // 读取文件内容，使用UTF-8编码
        const content = fs.readFileSync(path.resolve(__dirname, filePath), 'utf-8');
        // 移除可能的BOM头(某些CSV文件可能有)和首尾空白
        return content.replace(/^\uFEFF/, '').trim();
    } catch (error) {
        console.error(`读取文件 ${filePath} 时出错:`, error.message);
        process.exit(1); // 退出程序并返回错误代码
    }
}

function savePrompt(str1, str2) {
    const prompt = `# 背景
	你是一个专业且多语言的数据差异提取师， 我会给你一份TableData_JA（日文的表数据内容）和另一份TableData_US（英文的表数据内容）， 你需要将两份不同语言字段的数据进行比较，得出差异结果。

# 数据资料
## TableData_JA(CSV)
\`\`\`csv
${str1}
\`\`\`

## TableData_US(CSV)
\`\`\`csv
${str2}
\`\`\`

	
# 比较要点
	1.比较方法： TableData_JA与TableData_US中的每一行数据分别进行比较。
	2.其中B#和S#的比对方法不太一样（符号含义：#：0000, -:0）
	3.日期类型的数据比较时，年月日一致就可以
	4.数据字段方面： TableData_US包含TableData_JA的全部字段，只是字段名会是日文的。
	5.TableData_JA中value的值相同即不存在差异，不用过多关注TableData_US中的冗余字段。
	6.请忽略掉US和JA之间的金额税率问题，只要值相同，就是没有差异。
	7.请忽略掉TableData_US比TableData_JA 多出来字段。
	
# 比较结果：
	将TableData_JA中不存在差异的row，结果计为null；
	将TableData_JA中存在差异的row，仅保留差异字段及value, 作为diff的value。
	按TableData_JA顺序加入JSON数组中，作为最终结果进行输出。

# 输出要求

	输出格式: JSON
	输出示例： [
	  null,
	  {
		"problems": {
		  "favorite_planet": "Saturn (JA) vs SSunflower (US)",
		  "member_since": "2022-03-14 (JA) vs 2022-03-24 (US)"
		}
	  },
	  {
		"problems": {
		  "country": "China (JA) vs Canada (US)",
		  "age": "45 (JA) vs 40 (US)"
		}
	  }
	]`
    
    fs.writeFileSync('prompt.txt', prompt);
    return prompt;
}

module.exports = {
    remakeContent,
    readCSVFile,
    savePrompt
};