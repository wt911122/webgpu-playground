import { mat3, vec2 } from 'gl-matrix';
import msdftextShader from './msdftext.wgsl?raw';

import { paddingMat3, copyMat3 } from '../../utils/transform';
import { createBufferWithData } from '../../utils/buffer';
import { doOverlapBox } from '../../utils/box';

function MSDFTextPainter() {
    const MAX_OBJECTS = 30000;
    const roundUp = (v, alignment) => Math.ceil(v / alignment) * alignment;

    function generateRender(context) {
        const _objectInfos = [];
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
        })

        const textBindGroupLayout = device.createBindGroupLayout({
            label: 'MSDF text group layout',
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                    buffer: { type: 'read-only-storage' },
                },
            ],
        })

        const renderShapePipeline = device.createRenderPipeline({
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
                                srcFactor: 'src-alpha',
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
            depthStencil: {
                depthWriteEnabled: false,
                depthCompare: 'less',
                format: 'depth24plus',
            },
        });

        const MATIRIAL_OFFSET = 0;
        const TRAN_OFFSET = 8;
        const uniformBufferSize = (4 + 4 + 12) * 4; // r, zindex, fill, stroke, transformMat
       
        const uniformBufferSpace = roundUp(uniformBufferSize, device.limits.minUniformBufferOffsetAlignment);
        const uniformBuffer = device.createBuffer({
            label: 'uniforms',
            size: uniformBufferSpace * MAX_OBJECTS,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        const mappedTransferBuffers = [];
        const getMappedTransferBuffer = () => {
            return mappedTransferBuffers.pop() || device.createBuffer({
                label: 'transfer buffer',
                size: uniformBufferSpace * MAX_OBJECTS,
                usage: GPUBufferUsage.MAP_WRITE | GPUBufferUsage.COPY_SRC,
                mappedAtCreation: true,
            });
        };
        
        for (let i = 0; i < MAX_OBJECTS; ++i) {
            const uniformBufferOffset = i * uniformBufferSpace;
            const bindGroup =  device.createBindGroup({
                label: 'bindingGroup',
                layout: bindGroupLayout,
                entries: [
                    { binding: 0, resource: { buffer: context.worldUniformBuffer } },
                    { binding: 1, resource: { buffer: context.shapeUniformBuffer } },
                    { binding: 2, resource: { buffer: uniformBuffer,  offset: uniformBufferOffset, size: uniformBufferSize } },
                ],
            });
            // console.log(uniformBufferOffset, uniformBufferSize)
            _objectInfos.push({
                bindGroup
            })
        }
        
        function collecInstanceConfig(instance, config) {
            if(!config.enable) {
                return;
            }
            const { 
                fontFamily,
                content,
            } = config.getConfig();
            
            const font = context.jcanvas._MSDFfontRegistry.getFont(fontFamily)

            const textBuffer = device.createBuffer({
                label: 'msdf text buffer',
                size: (content.length) * Float32Array.BYTES_PER_ELEMENT * 4,
                usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
                mappedAtCreation: true,
            });

            const textArray = new Float32Array(textBuffer.getMappedRange());
            let offset = 0; // Accounts for the values managed by MsdfText internally.

            let measurements;
            // if (options.centered) {
            //     measurements = measureText(font, text);

            //     measureText(
            //         font,
            //         text,
            //         (textX, textY, line, char) => {
            //             const lineOffset =
            //                 measurements.width * -0.5 -
            //                 (measurements.width - measurements.lineWidths[line]) * -0.5;

            //             textArray[offset] = textX + lineOffset;
            //             textArray[offset + 1] = textY + measurements.height * 0.5;
            //             textArray[offset + 2] = char.charIndex;
            //             offset += 4;
            //         }
            //     );
            // } else {
                measurements = measureText(
                    font,
                    content,
                    (textX, textY, line, char) => {
                        textArray[offset] = textX;
                        textArray[offset + 1] = textY;
                        textArray[offset + 2] = char.charIndex;
                        offset += 4;
                    }
                );
            // }
                console.log(textArray)
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

            instance.width = measurements.width * instance.fontSize;
            instance.height = measurements.height * instance.fontSize;
            instance.updateBoundingBox();
        }

        function beforeRender(encoder, configs, cacheContext) {
            const numObjects = configs.length;
            const transferBuffer = getMappedTransferBuffer();
            const uniformValues = new Float32Array(transferBuffer.getMappedRange());

            const size = (numObjects - 1) * uniformBufferSpace + uniformBufferSize;
            encoder.copyBufferToBuffer(transferBuffer, 0, uniformBuffer, 0, size);
            cacheContext.uniformValues = uniformValues;
            cacheContext.transferBuffer = transferBuffer;
        }

        function render(encoder, passEncoder, configs, cacheContext) {
            const { uniformValues, transferBuffer } = cacheContext;
            const numObjects = configs.length;

            for (let i = 0; i < numObjects; ++i) {
                const config = configs[i];
                if(!config.enable) {
                    continue;
                }
                if(!doOverlapBox(config.getInstance().getBoundingBox(), viewport)) {
                    continue
                }
                const {
                    _zIndex, mat, fontSize,
                    _colors,
                } = config.getConfig();
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

            passEncoder.setPipeline(renderShapePipeline);

            for (let i = 0; i < numObjects; ++i) {
                const config = configs[i];
                if(!config.enable) {
                    continue;
                }
                if(!doOverlapBox(config.getInstance().getBoundingBox(), viewport)) {
                    continue
                }
                const font = config.getPainterConfig('Font');
                const textBindGroup = config.getBindGroup('TextBindGroup');
                const measurements = config.getPainterConfig('measurements');
                const {
                    bindGroup,
                } = _objectInfos[i];
                passEncoder.setBindGroup(0, bindGroup);
                passEncoder.setBindGroup(1, font.bindGroup);
                passEncoder.setBindGroup(2, textBindGroup);
                passEncoder.draw(4, measurements.printedCharCount);
            }
            transferBuffer.unmap();
        }

        function afterRender(cacheContext) {
            const transferBuffer = cacheContext.transferBuffer
            transferBuffer.mapAsync(GPUMapMode.WRITE).then(() => {
                mappedTransferBuffers.push(transferBuffer);
            });
        }

        // function onPainterCreate(registry, context) {
        //     const jcanvas = context.jcanvas;
        //     const _MSDFfontRegistry = jcanvas._MSDFfontRegistry;
        // }

        return {
            collecInstanceConfig,
            beforeRender,
            render, 
            afterRender,
            // onPainterCreate,
        };
    }

    
    return {
        name: 'MSDFTextPainter',
        generateRender,
        // Ctor: [Ellipse, Rectangle]
    }
}

export default MSDFTextPainter;


function measureText(
    font,
    text,
    charCallback
) {
    let maxWidth = 0;
    const lineWidths = [];

    let textOffsetX = 0;
    let textOffsetY = 0;
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
            textOffsetY += font.lineHeight;
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
        width: maxWidth,
        height: lineWidths.length * font.lineHeight,
        lineWidths,
        printedCharCount,
    };
}



