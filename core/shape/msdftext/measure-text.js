
const ELLIPSIS_TEXT = '...';

function measureEllipsisEndText(font) {
    let ellipsisWidth = 0;
    for (let i = 0; i < ELLIPSIS_TEXT.length; i++) {
        const code = ELLIPSIS_TEXT.charCodeAt(i);
        const nextCode = i < ELLIPSIS_TEXT.length - 1 ? ELLIPSIS_TEXT.charCodeAt(i + 1) : -1;
        ellipsisWidth += font.getXAdvance(code, nextCode);
    }
    return ellipsisWidth;
}

export function measureText(
    font,
    fontSize,
    text,
    lineHeight,
    definedWidth = Infinity, 
    definedHeight = Infinity,
    ellipsisEnd,
    charCallback,
) {
    const FontImgBaseSize = font.fontjson.info.size;
    const ratio = fontSize / FontImgBaseSize;
    const _lineHeight = lineHeight/ratio || font.lineHeight;
    const maxWidthInFontUnits = definedWidth / ratio; // 转换为字体单位
    const maxLines = definedHeight === Infinity ? Infinity : Math.max(Math.floor(definedHeight / lineHeight), 1); // 最大行数

    let ellipsisWidth = 0;
    if (ellipsisEnd) {
        ellipsisWidth = measureEllipsisEndText(font);
    }
    const maxWidthInEllipsisRemainInFontUnits = (definedWidth - ellipsisWidth)/ratio;
    const lineWidths = [];

    let useEllipsisEnd = false;
    let ellipsisEndTextIndex = Infinity;
    let ellipsisEndTextOffsetX = Infinity;
    let maxWidth = 0;
    let textOffsetX = 0;
    let textOffsetY = (lineHeight - fontSize) / 2 / ratio;
    let line = 0;
    let printedCharCount = 0;
    let nextCharCode = text.charCodeAt(0);

    for (let i = 0; i < text.length; ++i) {
        const charCode = nextCharCode;
        nextCharCode = i < text.length - 1 ? text.charCodeAt(i + 1) : -1;
        const lastLine = (line === maxLines-1);
        const charAdvance = font.getXAdvance(charCode, nextCharCode);
        switch (charCode) {
            case 10: // Newline - 手动换行
                if(lastLine) {
                    if(ellipsisEnd) {
                        ellipsisEndTextIndex = Math.min(ellipsisEndTextIndex, i);
                        ellipsisEndTextOffsetX = Math.min(ellipsisEndTextOffsetX, textOffsetX);
                        useEllipsisEnd = true;
                    }  else {
                        lineWidths.push(textOffsetX);
                        maxWidth = Math.max(maxWidth, textOffsetX);
                    }

                    i = text.length; // 终止循环
                    break;
                } else {
                    lineWidths.push(textOffsetX);
                    line++;
                    maxWidth = Math.max(maxWidth, textOffsetX);
                    textOffsetX = 0;
                    textOffsetY += _lineHeight;
                }
                break;
            case 13: // CR
                break;

            case 32:  // Space
                const nextX = textOffsetX + charAdvance;
                if(lastLine) {
                    if(ellipsisEnd) {
                       if(nextX > maxWidthInEllipsisRemainInFontUnits) {
                            ellipsisEndTextIndex = i;
                            ellipsisEndTextOffsetX = textOffsetX;
                            if (nextX > maxWidthInFontUnits) {
                                // 到达此行末尾
                                useEllipsisEnd = true;
                                i = text.length; // 终止循环
                                break;
                            } else {
                                // 未到达此行末尾
                                textOffsetX += charAdvance;
                            }
                        }
                    } else {
                        if (nextX > maxWidthInFontUnits) {
                            lineWidths.push(textOffsetX);
                            maxWidth = Math.max(maxWidth, textOffsetX);
                            i = text.length; // 终止循环
                            break;
                        } else {
                            textOffsetX += charAdvance;
                        }
                    }
                } else {
                    if (nextX > maxWidthInFontUnits) {
                        lineWidths.push(textOffsetX);
                        line++;
                        maxWidth = Math.max(maxWidth, textOffsetX);
                        textOffsetX = 0;
                        textOffsetY += _lineHeight;
                    } else {
                        textOffsetX += charAdvance;
                    }
                   
                }
                break;

            default: {
                const nextX = textOffsetX + charAdvance;
                // 超出具有 ellipsis 的宽度时
                if(lastLine) {
                    // 最后一行
                    if(ellipsisEnd) {
                        // 使用省略号结尾
                        if(nextX > maxWidthInEllipsisRemainInFontUnits) {
                            ellipsisEndTextIndex = Math.min(ellipsisEndTextIndex, i);
                            ellipsisEndTextOffsetX = Math.min(ellipsisEndTextOffsetX, textOffsetX);
                            if (nextX > maxWidthInFontUnits) {
                                // 到达此行末尾
                                useEllipsisEnd = true;
                                i = text.length; // 终止循环
                                break;
                            } else {
                                // 未到达此行末尾
                                textOffsetX += charAdvance;
                            }
                        } else {
                            if (charCallback) {
                                charCallback(
                                    textOffsetX,
                                    textOffsetY,
                                    line,
                                    font.getChar(charCode)
                                );
                            }
                            textOffsetX += charAdvance;
                            printedCharCount++;
                        }
                    } else {
                        // 直接截断
                        if (nextX > maxWidthInFontUnits) {
                            const c = font.getChar(charCode);
                            if(c.width + textOffsetX < maxWidthInFontUnits && charCallback) {
                                charCallback(
                                    textOffsetX-c.xoffset,
                                    textOffsetY,
                                    line,
                                    font.getChar(charCode)
                                );
                                printedCharCount++;
                                textOffsetX += c.width;
                            }
                            i = text.length; // 终止循环
                            break;
                        } 
                        if (charCallback) {
                            charCallback(
                                textOffsetX,
                                textOffsetY,
                                line,
                                font.getChar(charCode)
                            );
                        }
                        textOffsetX += charAdvance;
                        printedCharCount++;
                    }
                } else {
                    // 普通行
                    if (nextX > maxWidthInFontUnits) {
                        lineWidths.push(textOffsetX);
                        line++;
                        maxWidth = Math.max(maxWidth, textOffsetX);
                        textOffsetX = 0;
                        textOffsetY += _lineHeight;
                    } 
                    if (charCallback) {
                        charCallback(
                            textOffsetX,
                            textOffsetY,
                            line,
                            font.getChar(charCode)
                        );
                    }
                    textOffsetX += charAdvance;
                    printedCharCount++;
                }

            }
        }
    }

    if(ellipsisEnd && ellipsisEndTextIndex !== Infinity) {
        nextCharCode = text.charCodeAt(ellipsisEndTextIndex);
        textOffsetX = ellipsisEndTextOffsetX;
        if(useEllipsisEnd) {
            for (let i = 0; i < ELLIPSIS_TEXT.length; i++) {
                const code = ELLIPSIS_TEXT.charCodeAt(i);
                const nextCode = i < ELLIPSIS_TEXT.length - 1 ? ELLIPSIS_TEXT.charCodeAt(i + 1) : -1;
                
                charCallback(
                    textOffsetX,
                    textOffsetY,
                    line,
                    font.getChar(code)
                );
                
                textOffsetX += font.getXAdvance(code, nextCode);
                printedCharCount++;
            }
        } else {
            for (let i = ellipsisEndTextIndex; i < text.length; ++i) {
                const charCode = nextCharCode;
                nextCharCode = i < text.length - 1 ? text.charCodeAt(i + 1) : -1;
                const charAdvance = font.getXAdvance(charCode, nextCharCode);
                if(charCode !== 10 && charCode !== 32 && charCode !== 13) {
                    charCallback(
                        textOffsetX,
                        textOffsetY,
                        line,
                        font.getChar(charCode)
                    );
                    printedCharCount++;
                }

                textOffsetX += charAdvance;
                
            }
        }
        maxWidth = Math.max(maxWidth, textOffsetX);
        lineWidths.push(textOffsetX);
    } else {
        lineWidths.push(textOffsetX);
        maxWidth = Math.max(maxWidth, textOffsetX);
    }

    return {
        lineWidths,
        width: maxWidth * ratio, 
        height: lineWidths.length * lineHeight,
        printedCharCount,
    }
}