import { mat3, vec2 } from 'gl-matrix';
import msdftextShader from './msdftext.wgsl?raw';

import { paddingMat3, copyMat3 } from '../../utils/transform';
import { createBufferWithData } from '../../utils/buffer';
import { doOverlapBoxBounding } from '../../utils/box';
import { 
    GENERAL_DEPTH_STENCIL_CONFIG,
    MASK_BEGIN_DEPTH_STENCIL_CONFIG,
    MASK_END_DEPTH_STENCIL_CONFIG,
} from '../../utils/mask-depthStencil-config';
import { prepareUniform } from '../../utils/shape-uniform';
import { measureText } from './measure-text';

function MSDFTextPainter() {
    const MAX_OBJECTS = 30000;

    function generateRender(context) {
        const device = context.device;
        const viewport = context.viewport;
        const shapeProgram = device.createShaderModule({
            code: msdftextShader,
        });
        const bindGroupLayout = device.createBindGroupLayout({
            label: 'MSDF camera uniform buffer',
            entries: [
                { 
                    binding: 0, visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX,
                    buffer: { type: 'uniform', minBindingSize: 160 },
                },
                { 
                    binding: 1, visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX,
                    buffer: { type: 'uniform', minBindingSize: 4 },
                },
                { 
                    binding: 2, visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX,
                    buffer: { type: 'uniform', minBindingSize: 80 },
                },
            ],
        });

        const fontBindGroupLayout = device.createBindGroupLayout({
            label: 'MSDF pipline group layout',
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: {
                        viewDimension: '2d-array',
                    },
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.FRAGMENT,
                    sampler: {},
                },
                {
                    binding: 2,
                    visibility: GPUShaderStage.VERTEX,
                    buffer: { type: 'read-only-storage' },
                },
            ]
        });

        const textBindGroupLayout = device.createBindGroupLayout({
            label: 'MSDF text group layout',
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                    buffer: { type: 'read-only-storage' },
                },
            ],
        });

        const pipelineDescription = {
            label: `msdf text pipeline`,
            layout: device.createPipelineLayout({
                bindGroupLayouts: [
                    bindGroupLayout,
                    fontBindGroupLayout, 
                    textBindGroupLayout
                ],
            }),
            vertex: {
                module: shapeProgram,
                entryPoint: 'vs',
            },
            fragment: {
                module: shapeProgram,
                entryPoint: 'fs',
                targets: [
                    {
                        format: navigator.gpu.getPreferredCanvasFormat(), 
                        blend: {
                            color: {
                                operation: 'add',
                                srcFactor: 'one',
                                dstFactor: 'one-minus-src-alpha'
                            },
                            alpha: {
                                operation: 'add',
                                srcFactor: 'one',
                                dstFactor: 'one-minus-src-alpha'
                            }
                        }
                    },
                ],
            },
            primitive: {
                topology: 'triangle-strip',
                stripIndexFormat: 'uint32',
            },
        }

        const renderShapePipeline = device.createRenderPipeline({
            ...pipelineDescription,
            depthStencil: GENERAL_DEPTH_STENCIL_CONFIG
        });
        const MaskBeginPipline = device.createRenderPipeline({
            ...pipelineDescription,
            depthStencil: MASK_BEGIN_DEPTH_STENCIL_CONFIG
        });
        const MaskEndPipline = device.createRenderPipeline({
            ...pipelineDescription,
            depthStencil: MASK_END_DEPTH_STENCIL_CONFIG
        });
        const MATIRIAL_OFFSET = 0;
        const TRAN_OFFSET = 8;
        const uniformBufferSize = (4 + 4 + 12) * 4; 
        const {
            uniformBufferSpace,
            bindGroups,
            prepareRender,
            cacheTransferBuffer
        } = prepareUniform(device, {
            MAX_OBJECTS,
            uniformBufferSize,
            bindGroupLayout,
            context,
            label: 'msdf'
        });

        function collecInstanceConfig(instance, config) {
            if(!config.enable) {
                return;
            }
            const { 
                fontFamily,
                content,
                textAlignVertical,
                textAlignHorizontal,
                definedWidth,
                definedHeight,
                lineHeight,
                autoWrap,
                ellipseEnd
            } = config.getConfig();
            const fontSize = instance.fontSize;
            const font = context.jcanvas._MSDFfontRegistry.getFont(fontFamily);
            const FontImgBaseSize = font.fontjson.info.size;
            const ratio = fontSize / FontImgBaseSize;
            config.setPainterConfig('REAL_FONTSIZE', ratio);

            const textBuffer = device.createBuffer({
                label: 'msdf text buffer',
                size: (content.length) * Float32Array.BYTES_PER_ELEMENT * 4,
                usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
                mappedAtCreation: true,
            });

            const textArray = new Float32Array(textBuffer.getMappedRange());
            let offset = 0; // Accounts for the values managed by MsdfText internally.
            const _lineHeight = lineHeight || fontSize;
            let measurements;
            if (textAlignHorizontal === 'CENTER') {
                measurements = measureText(font, fontSize, content, _lineHeight, definedWidth, definedHeight, ellipseEnd);
                const w = definedWidth; // || measurements.width;
                measureText(
                    font,
                    fontSize,
                    content,
                    _lineHeight,
                    definedWidth, 
                    definedHeight,
                    ellipseEnd,
                    (textX, textY, line, char) => {
                        const lineOffset = (w * 0.5 - measurements.lineWidths[line] * ratio * 0.5) / ratio;

                        textArray[offset] = textX + lineOffset;
                        textArray[offset + 1] = textY;
                        textArray[offset + 2] = char.charIndex;
                        offset += 4;
                    },
                );
            } else {
                measurements = measureText(
                    font,
                    fontSize,
                    content,
                    _lineHeight,
                    definedWidth, 
                    definedHeight,
                    ellipseEnd,
                    (textX, textY, line, char) => {
                        textArray[offset] = textX;
                        textArray[offset + 1] = textY;
                        textArray[offset + 2] = char.charIndex;
                        offset += 4;
                    }
                );
            }
                // console.log(textArray)
            textBuffer.unmap();

            const bindGroup = device.createBindGroup({
                label: 'msdf text bind group',
                layout: textBindGroupLayout,
                entries: [
                    {
                        binding: 0,
                        resource: { buffer: textBuffer },
                    },
                ],
            });
                
            config.addBuffer('TextBuffer', textBuffer)
            config.setPainterConfig('measurements', measurements);
            config.setPainterConfig('Font', font);
            config.addBindGroup('TextBindGroup', bindGroup)

            instance.textWidth = measurements.width;
            instance.textHeight = measurements.height;
            instance.measureWidth();
            instance.updateBoundingBox();
        }

        function beforeRender(encoder, configs, cacheContext) {
            const numObjects = configs.length;
            const { uniformValues, transferBuffer } = prepareRender(encoder, numObjects)
            
            cacheContext.transferBuffer = transferBuffer;
            for (let i = 0; i < numObjects; ++i) {
                const config = configs[i];
                if(!config.enable) {
                    continue;
                }
                const {
                    _zIndex, mat,
                    _colors,
                } = config.getConfig();
                const fontSize = config.getPainterConfig('REAL_FONTSIZE');
                const uniformBufferOffset = i * uniformBufferSpace;
                const f32Offset = uniformBufferOffset / 4;
                const materialValue = uniformValues.subarray(
                    f32Offset + MATIRIAL_OFFSET, 
                    f32Offset + TRAN_OFFSET);
                const shapeMatrixValue = uniformValues.subarray(
                    f32Offset + TRAN_OFFSET, 
                    f32Offset + TRAN_OFFSET + 12);

                materialValue[0] = _zIndex;
                materialValue[1] = fontSize;

                // fill
                materialValue[4] = _colors[0];
                materialValue[5] = _colors[1];
                materialValue[6] = _colors[2];
                materialValue[7] = _colors[3];
                copyMat3(shapeMatrixValue, mat);
            }
            transferBuffer.unmap();
        }

        function render(encoder, passEncoder, maskIndex, configs, cacheContext, renderCondition) {
            let _f = false;
            const numObjects = configs.length;
            for (let i = 0; i < numObjects; ++i) {
                const config = configs[i];
                if(!config.enable) {
                    continue;
                }
                const instance = config.getInstance();
                if(instance._maskIndex !== maskIndex) {
                    continue;
                }
                if(renderCondition && !renderCondition(instance)){
                    continue;
                }
                if(!doOverlapBoxBounding(config.getInstance().getBoundingBox(), viewport)) {
                    continue
                }
                // if(!doOverlapBoxBounding(config.getInstance().getBoundingBox(), viewport)) {
                //     continue
                // }
                if(!_f) {
                    passEncoder.setPipeline(renderShapePipeline);
                    _f = true;
                }
                const font = config.getPainterConfig('Font');
                const textBindGroup = config.getBindGroup('TextBindGroup');
                const measurements = config.getPainterConfig('measurements');
                const bindGroup = bindGroups[i];
                passEncoder.setBindGroup(0, bindGroup);
                passEncoder.setBindGroup(1, font.bindGroup);
                passEncoder.setBindGroup(2, textBindGroup);
                passEncoder.draw(4, measurements.printedCharCount);
            }
        }

        function afterRender(cacheContext) {
            const transferBuffer = cacheContext.transferBuffer
            transferBuffer.mapAsync(GPUMapMode.WRITE).then(() => {
                cacheTransferBuffer(transferBuffer);
            });
        }

         function renderMaskBegin(encoder, passEncoder, configs, cacheContext) {
            const { configIndex } = cacheContext;
            const bindGroup = bindGroups[configIndex];
            const config = configs[configIndex];
            passEncoder.setPipeline(MaskBeginPipline);
            const font = config.getPainterConfig('Font');
            const textBindGroup = config.getBindGroup('TextBindGroup');
            const measurements = config.getPainterConfig('measurements');
            passEncoder.setBindGroup(0, bindGroup);
            passEncoder.setBindGroup(1, font.bindGroup);
            passEncoder.setBindGroup(2, textBindGroup);
            passEncoder.draw(4, measurements.printedCharCount);
        }

         function renderMaskEnd(encoder, passEncoder, configs, cacheContext) {
            const { configIndex } = cacheContext;
            const bindGroup = bindGroups[configIndex];
            const config = configs[configIndex];
            passEncoder.setPipeline(MaskEndPipline);
            const font = config.getPainterConfig('Font');
            const textBindGroup = config.getBindGroup('TextBindGroup');
            const measurements = config.getPainterConfig('measurements');
            passEncoder.setBindGroup(0, bindGroup);
            passEncoder.setBindGroup(1, font.bindGroup);
            passEncoder.setBindGroup(2, textBindGroup);
            passEncoder.draw(4, measurements.printedCharCount);
        }
        return {
            collecInstanceConfig,
            beforeRender,
            render, 
            afterRender,
            renderMaskBegin,
            renderMaskEnd
        };

    }
    return {
        name: 'MSDFTextPainter',
        generateRender,
        // Ctor: [Ellipse, Rectangle]
    }
}

export default MSDFTextPainter;
/* 
function measureText(
    font,
    fontSize,
    text,
    lineHeight,
    charCallback
) {
    let maxWidth = 0;
    const lineWidths = [];
    const FontImgBaseSize = font.fontjson.info.size;
    const ratio = fontSize / FontImgBaseSize;
    const _lineHeight = lineHeight || font.lineHeight;

    let textOffsetX = 0;
    let textOffsetY = (lineHeight - fontSize)/2/ratio;
    let line = 0;
    let printedCharCount = 0;
    let nextCharCode = text.charCodeAt(0);
    for (let i = 0; i < text.length; ++i) {
        const charCode = nextCharCode;
        nextCharCode = i < text.length - 1 ? text.charCodeAt(i + 1) : -1;

        switch (charCode) {
            case 10: // Newline
                lineWidths.push(textOffsetX);
                line++;
                maxWidth = Math.max(maxWidth, textOffsetX);
                textOffsetX = 0;
                textOffsetY += _lineHeight;
            case 13: // CR
                break;
            case 32: // Space
                // For spaces, advance the offset without actually adding a character.
                textOffsetX += font.getXAdvance(charCode);
            break;
            default: {
                if (charCallback) {
                    charCallback(
                        textOffsetX,
                        textOffsetY,
                        line,
                        font.getChar(charCode)
                    );
                }
                textOffsetX += font.getXAdvance(charCode, nextCharCode);
                printedCharCount++;
            }
        }
    }

    lineWidths.push(textOffsetX);
    maxWidth = Math.max(maxWidth, textOffsetX);

    return {
        width: maxWidth*ratio,
        height: lineWidths.length * _lineHeight,
        lineWidths,
        printedCharCount,
    };
}*/
/* 
function measureText(
    font,
    fontSize,
    text,
    lineHeight,
    maxLineWidth = Infinity, // 新增参数：最大行宽，默认无限制
    ellipsis = false,
    charCallback,
) {
    let maxWidth = 0;
    const lineWidths = [];
    const FontImgBaseSize = font.fontjson.info.size;
    const ratio = fontSize / FontImgBaseSize;
    const _lineHeight = lineHeight/ratio || font.lineHeight;
    let maxWidthInFontUnits = maxLineWidth / ratio; // 转换为字体单位

    let textOffsetX = 0;
    let textOffsetY = (lineHeight - fontSize) / 2 / ratio;
    let line = 0;
    let printedCharCount = 0;
    let nextCharCode = text.charCodeAt(0);

    const ellipsisText = '...';
    let ellipsisWidth = 0;
    if (ellipsis) {
        // 计算省略号的宽度
        for (let i = 0; i < ellipsisText.length; i++) {
            const code = ellipsisText.charCodeAt(i);
            const nextCode = i < ellipsisText.length - 1 ? ellipsisText.charCodeAt(i + 1) : -1;
            ellipsisWidth += font.getXAdvance(code, nextCode);
        }
        maxWidthInFontUnits -= ellipsisWidth;
    }
    
    // if (ellipsis) {
    //     // 计算省略号的宽度
    //     for (let i = 0; i < ellipsisText.length; i++) {
    //         const code = ellipsisText.charCodeAt(i);
    //         const nextCode = i < ellipsisText.length - 1 ? ellipsisText.charCodeAt(i + 1) : -1;
    //         ellipsisWidth += font.getXAdvance(code, nextCode);
    //     }
    // }
    let isEllipsisApplied = false;
    
    for (let i = 0; i < text.length; ++i) {
        const charCode = nextCharCode;
        nextCharCode = i < text.length - 1 ? text.charCodeAt(i + 1) : -1;
        
        const charAdvance = font.getXAdvance(charCode, nextCharCode);

        switch (charCode) {
            case 10: // Newline - 手动换行
                if (ellipsis && line >= 0) {
                    // 省略号模式下，遇到换行符直接结束
                    lineWidths.push(textOffsetX);
                    maxWidth = Math.max(maxWidth, textOffsetX);
                    isEllipsisApplied = true;
                    i = text.length; // 终止循环
                    break;
                }
                lineWidths.push(textOffsetX);
                line++;
                maxWidth = Math.max(maxWidth, textOffsetX);
                textOffsetX = 0;
                textOffsetY += _lineHeight;
                break;
                
            case 13: // CR
                break;
                
            case 32: // Space
                // 检查空格是否导致超出宽度
                if (textOffsetX + charAdvance > maxWidthInFontUnits) {
                    // 空格超出宽度，换行
                    if (ellipsis) {
                        // 省略号模式，超出宽度直接结束
                        lineWidths.push(textOffsetX);
                        maxWidth = Math.max(maxWidth, textOffsetX);
                        isEllipsisApplied = true;
                        i = text.length; // 终止循环
                        break;
                    }
                    lineWidths.push(textOffsetX);
                    line++;
                    maxWidth = Math.max(maxWidth, textOffsetX);
                    textOffsetX = 0;
                    textOffsetY += _lineHeight;
                } else {
                    // 空格不超出，正常前进
                    textOffsetX += charAdvance;
                }
                break;
                
            default: {
                const nextX = textOffsetX + charAdvance;
                
                // 检查是否超出最大宽度
                if (nextX > maxWidthInFontUnits) {
                    // 超出宽度，换行后再绘制当前字符
                    if (ellipsis) {
                        // 省略号模式，超出宽度直接结束
                        lineWidths.push(textOffsetX);
                        maxWidth = Math.max(maxWidth, textOffsetX);
                        isEllipsisApplied = true;
                        i = text.length; // 终止循环
                        break;
                    }
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

    if (ellipsis && isEllipsisApplied) {
        for (let i = 0; i < ellipsisText.length; i++) {
            const code = ellipsisText.charCodeAt(i);
            const nextCode = i < ellipsisText.length - 1 ? ellipsisText.charCodeAt(i + 1) : -1;
            
            charCallback(
                textOffsetX,
                textOffsetY,
                line,
                font.getChar(code)
            );
            
            textOffsetX += font.getXAdvance(code, nextCode);
            printedCharCount++;
        }
    }

    lineWidths.push(textOffsetX);
    maxWidth = Math.max(maxWidth, textOffsetX);
    // console.log(lineWidths.length, _lineHeight, lineHeight)
    return {
        width: maxWidth * ratio,
        height: (ellipsis ? 1 : lineWidths.length) * lineHeight,
        lineWidths,
        printedCharCount,
    };
}
*/