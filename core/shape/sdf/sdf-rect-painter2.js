import Layer from '../../layer/layer';
import { mat3, vec2 } from 'gl-matrix';
import sdfShader from './rect.wgsl?raw';
import sdfMaskShader from './rect-mask.wgsl?raw';
import sdfTextureShader from './rect-texture.wgsl?raw';
import shadowShader from './shadow.wgsl?raw';
// console.log(circleShader)
import { paddingMat3, copyMat3 } from '../../utils/transform';
import { createBufferWithData } from '../../utils/buffer';
import { 
    GENERAL_DEPTH_STENCIL_CONFIG,
    MASK_BEGIN_DEPTH_STENCIL_CONFIG,
    MASK_END_DEPTH_STENCIL_CONFIG,
} from '../../utils/mask-depthStencil-config';
import { prepareUniform } from '../../utils/shape-uniform';
import { doOverlapBoxBounding } from '../../utils/box';

function SDFRectPainter() {
    const MAX_OBJECTS = 30000;
    const VERTEX_ARRAY = new Float32Array([
        -1, -1, 1, -1, 1, 1, -1, 1
    ]);
    const INDICES_ARRAY = new Uint16Array([
        0, 1, 2, 0, 2, 3
    ]);

    const VERTEX_ARRAY_TEXTURE = new Float32Array([
        -1, -1,     -1,  1,
         1, -1,      1,  1,
         1,  1,      1, -1,
        -1,  1,     -1, -1
    ]); 
     const preferredCanvasFormat = navigator.gpu.getPreferredCanvasFormat();
    function generateTextureRender(context) {
        const device = context.device;
        const defaultTexture = context.texturePainter.defaultTexture;
        const shapeProgram = device.createShaderModule({
            code: sdfTextureShader,
        });

        const vertexBuffer = createBufferWithData(device, VERTEX_ARRAY_TEXTURE, GPUBufferUsage.VERTEX);
        const indicesBuffer = createBufferWithData(device, INDICES_ARRAY, GPUBufferUsage.INDEX);
        

        const bindGroupLayout = device.createBindGroupLayout({
            entries: [
                { 
                    binding: 0, visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX,
                    buffer: { type: 'uniform', minBindingSize: 80 },
                },
            ],
        });
        const textureBindGroupLayout = context.texturePainter.textureBindGroupLayout;
        const pipelineLayout = device.createPipelineLayout({
            bindGroupLayouts: [ bindGroupLayout, textureBindGroupLayout ],
        });


        const pipelineDescription = {
            label: 'mesh texture pipeline',
            layout: pipelineLayout,
            vertex: {
                module: shapeProgram,
                entryPoint: "vs",
                buffers: [
                    {
                        arrayStride: 4 * 4,
                        attributes: [
                            { shaderLocation: 0, offset: 0, format: 'float32x2' },
                            { shaderLocation: 1, offset: 8, format: 'float32x2' },
                        ],
                        stepMode: "vertex"
                    },
                ],
            },
            fragment: {
                module: shapeProgram,
                entryPoint: "fs",
                targets: [{ 
                    format: preferredCanvasFormat, 
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
                }],

            },
        }

        const renderShapePipeline = device.createRenderPipeline(pipelineDescription);
        function renderTexture(instance, config, originTexture) {
            const { 
                x, y, w, h, strokeWidth, borderRadius, type, _zIndex, mat, _colors, texture, _opacity
            } = config;

            const uniformBuffer = device.createBuffer({
                size: Float32Array.BYTES_PER_ELEMENT * 80,
                usage: GPUBufferUsage.UNIFORM,
                mappedAtCreation: true,
            }) ;
            const uniformValue = new Float32Array(uniformBuffer.getMappedRange());
            uniformValue[0] = w;
            uniformValue[1] = h;
            uniformValue[2] = type;
            uniformValue[3] = texture ? 1: 0;
           
            uniformValue[4] = strokeWidth.top;
            uniformValue[5] = strokeWidth.right;
            uniformValue[6] = strokeWidth.bottom;
            uniformValue[7] = strokeWidth.left;

            uniformValue[8] = borderRadius?.topRight || 0;
            uniformValue[9] = borderRadius?.bottomRight  || 0;
            uniformValue[10] = borderRadius?.topLeft  || 0;
            uniformValue[11] = borderRadius?.bottomLeft || 0;

            uniformValue[12] = _colors[0];
            uniformValue[13] = _colors[1];
            uniformValue[14] = _colors[2];
            uniformValue[15] = _colors[3];

            uniformValue[16] = _colors[4];
            uniformValue[17] = _colors[5];
            uniformValue[18] = _colors[6];
            uniformValue[19] = _colors[7];
            uniformBuffer.unmap();

            const bindGroup = device.createBindGroup({
                label: 'bindingGroup',
                layout: bindGroupLayout,
                entries: [
                    { binding: 0, resource: { buffer: uniformBuffer } },
                ],
            });
            let textureBindGroup;
            if(texture) {
                if(texture.dirty) {
                    texture.paint(context.texturePainter);
                }
                textureBindGroup = texture.bindGroup;
            } else {
                textureBindGroup = defaultTexture.bindGroup;
            }

            const encoder = device.createCommandEncoder();
            const pass = encoder.beginRenderPass({
                label: 'rect texture render pass',
                colorAttachments: [
                    {
                        view: originTexture.createView(),
                        clearValue: [0,0,0,0],
                        loadOp: 'clear',
                        storeOp: 'store',
                        format: preferredCanvasFormat, 
                    }
                ]
            });
            pass.setPipeline(renderShapePipeline);
            pass.setVertexBuffer(0, vertexBuffer);
            pass.setIndexBuffer(indicesBuffer, 'uint16');
            pass.setBindGroup(0, bindGroup);    
            pass.setBindGroup(1, textureBindGroup);
            pass.drawIndexed(6, 1);
            pass.end();

            device.queue.submit([encoder.finish()]);
        }
        
        return {
            renderTexture
        }
    }
    
    function generateRender(context) {
        const device = context.device;
        const defaultTexture = context.texturePainter.defaultTexture;
        const shapeProgram = device.createShaderModule({
            code: sdfShader,
        });
        const shapeMaskProgram = device.createShaderModule({
            code: sdfMaskShader,
        })
        const rectShadowProgram = device.createShaderModule({
            code: shadowShader,
        })
        const vertexBuffer = createBufferWithData(device, VERTEX_ARRAY, GPUBufferUsage.VERTEX);
        const indicesBuffer = createBufferWithData(device, INDICES_ARRAY, GPUBufferUsage.INDEX);
        

        const bindGroupLayout = device.createBindGroupLayout({
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
                    buffer: { type: 'uniform', minBindingSize: 176 },
                },
            ],
        });
        const textureBindGroupLayout = context.texturePainter.textureBindGroupLayout;
        const pipelineLayout = device.createPipelineLayout({
            bindGroupLayouts: [ bindGroupLayout, textureBindGroupLayout ],
        });
        const pipelineDescription = (program, pipelineLayout, writeMask = GPUColorWrite.ALL) => ({
            label: 'shape pipeline',
            layout: pipelineLayout,
            vertex: {
                module: program,
                entryPoint: "vs",
                buffers: [
                    {
                        arrayStride: 4 * 2,
                        attributes: [
                            { shaderLocation: 0, offset: 0, format: 'float32x2' },
                        ],
                        stepMode: "vertex"
                    },
                ],
            },
            fragment: {
                module: program,
                entryPoint: "fs",
                targets: [{ 
                    format: navigator.gpu.getPreferredCanvasFormat(), 
                    writeMask, 
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
                }],

            },
        })

        const renderShapePipeline = device.createRenderPipeline({
            ...pipelineDescription(shapeProgram, pipelineLayout),
            depthStencil: GENERAL_DEPTH_STENCIL_CONFIG
        });


        const maskpipelineLayout = device.createPipelineLayout({
            bindGroupLayouts: [ bindGroupLayout ],
        });
        const MaskBeginPipline = device.createRenderPipeline({
            ...pipelineDescription(shapeMaskProgram, maskpipelineLayout, 0),
            depthStencil: MASK_BEGIN_DEPTH_STENCIL_CONFIG
        });
        const MaskEndPipline = device.createRenderPipeline({
            ...pipelineDescription(shapeMaskProgram, maskpipelineLayout, 0),
            depthStencil: MASK_END_DEPTH_STENCIL_CONFIG
        });
        
        const MATIRIAL_OFFSET = 0;
        const TRAN_OFFSET = 24;
        const SHADOW_OFFSET = 32;
        const uniformBufferSize = (4 + 4 + 4 + 4 + 4 + 4 + 12 + 4 + 4) * 4; 
        const {
            uniformBufferSpace,
            bindGroups,
            prepareRender,
            cacheTransferBuffer,
            transferData,
            transferInstanceData
        } = prepareUniform(device, {
            MAX_OBJECTS,
            uniformBufferSize,
            bindGroupLayout,
            context,
            label: 'rectangle'
        });
        function collecInstanceConfig(instance, config) {
            if(!config.enable) {
                config.addBindGroup('textureBindGroup', defaultTexture.bindGroup)
                return;
            }
            const { 
                texture,
            } = config.getConfig();
            if(texture) {
                if(texture.dirty) {
                    texture.paint(context.texturePainter);
                }
                config.addBindGroup('textureBindGroup', texture.bindGroup)
            } else {
                config.addBindGroup('textureBindGroup', defaultTexture.bindGroup)
            }
        }

        function _updateInstanceUniform(config, i, uniformValues) {
            const {
                x, y, w, h, strokeWidth, borderRadius, type, _zIndex, mat, _colors, texture, _opacity
            } = config.getConfig();
            const uniformBufferOffset = i * uniformBufferSpace;
            const f32Offset = uniformBufferOffset / 4;
            const materialValue = uniformValues.subarray(
                f32Offset + MATIRIAL_OFFSET, 
                f32Offset + TRAN_OFFSET);
            const shapeMatrixValue = uniformValues.subarray(
                f32Offset + TRAN_OFFSET, 
                f32Offset + TRAN_OFFSET + 12);
            
            materialValue[0] = x;
            materialValue[1] = y;
            materialValue[2] = w;
            materialValue[3] = h;

            materialValue[4] = _zIndex;
            materialValue[5] = type;
            materialValue[6] = _opacity;//_strokeLineDash?.length || 0;
            materialValue[7] = texture ? 1: 0;

            materialValue[8] = strokeWidth.top;
            materialValue[9] = strokeWidth.right;
            materialValue[10] = strokeWidth.bottom;
            materialValue[11] = strokeWidth.left;

            materialValue[12] = borderRadius?.topRight || 0;
            materialValue[13] = borderRadius?.bottomRight  || 0;
            materialValue[14] = borderRadius?.topLeft  || 0;
            materialValue[15] = borderRadius?.bottomLeft || 0;
            
            // fill
            materialValue[16] = _colors[0];
            materialValue[17] = _colors[1];
            materialValue[18] = _colors[2];
            materialValue[19] = _colors[3];
            // stroke
            materialValue[20] = _colors[4];
            materialValue[21] = _colors[5];
            materialValue[22] = _colors[6];
            materialValue[23] = _colors[7];
            copyMat3(shapeMatrixValue, mat);
        }

        function prepareUniformBuffer(encoder, configs, cacheContext) {
            const numObjects = configs.length;
            // console.log(numObjects);
            const { uniformValues, transferBuffer } = prepareRender(encoder, numObjects)
            
            for (let i = 0; i < numObjects; ++i) {
                const config = configs[i];
                if(!config.enable) {
                    continue;
                }
                _updateInstanceUniform(config, i, uniformValues)
            }

            transferBuffer.unmap();
            // console.log('unmap');
            transferData(encoder, transferBuffer, numObjects);
            cacheContext.transferBuffer = transferBuffer;
        }
        
        // function updateInstancesUniformBuffer(encoder, configs, ids) {
        //     const { uniformValues, transferBuffer } = prepareRender(encoder, numObjects);
        //     ids.forEach(i => {
        //         _updateInstanceUniform(config, i, uniformValues);
        //     })
        //     transferBuffer.unmap();
        //     transferInstanceData(encoder, transferBuffer, ids);
        // }

        // const layers = [11, 12];
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
                if(!_f) {
                    passEncoder.setPipeline(renderShapePipeline);
                    passEncoder.setVertexBuffer(0, vertexBuffer);
                    passEncoder.setIndexBuffer(indicesBuffer, 'uint16');
                    _f = true;
                }
                const bindGroup = bindGroups[i];
                const textureBindGroup = config.getBindGroup('textureBindGroup');
                passEncoder.setBindGroup(0, bindGroup);  
                passEncoder.setBindGroup(1, textureBindGroup);   
                passEncoder.drawIndexed(6, 1);
            }
        }

        function usePipeline(passEncoder) {
            passEncoder.setPipeline(renderShapePipeline);
            passEncoder.setVertexBuffer(0, vertexBuffer);
            passEncoder.setIndexBuffer(indicesBuffer, 'uint16');
        }

        function renderInstance(passEncoder, configs, i) {
            const config = configs[i];
            if(!config.enable) {
                return;
            }
            const bindGroup = bindGroups[i];
            const textureBindGroup = config.getBindGroup('textureBindGroup');
            passEncoder.setBindGroup(0, bindGroup);  
            passEncoder.setBindGroup(1, textureBindGroup);   
            passEncoder.drawIndexed(6, 1);
        }

        function prepareTransferBuffer(cacheContext) {
            const transferBuffer = cacheContext.transferBuffer;
            transferBuffer.mapAsync(GPUMapMode.WRITE).then(() => {
                cacheTransferBuffer(transferBuffer);
            });
        }


        function renderMaskBegin(encoder, passEncoder, configs, configIndex, cacheContext) {
            const bindGroup = bindGroups[configIndex];
            passEncoder.setPipeline(MaskBeginPipline);
            passEncoder.setVertexBuffer(0, vertexBuffer);
            passEncoder.setIndexBuffer(indicesBuffer, 'uint16');
            passEncoder.setBindGroup(0, bindGroup);   
            passEncoder.drawIndexed(6, 1);
        }

        function renderMaskEnd(encoder, passEncoder, configs, configIndex, cacheContext) {
            const bindGroup = bindGroups[configIndex];
            passEncoder.setPipeline(MaskEndPipline);
            passEncoder.setVertexBuffer(0, vertexBuffer);
            passEncoder.setIndexBuffer(indicesBuffer, 'uint16');
            passEncoder.setBindGroup(0, bindGroup);   
            passEncoder.drawIndexed(6, 1);
        }

        return {
            collecInstanceConfig,
            prepareUniformBuffer,
            // updateInstancesUniformBuffer,
            render, 
            prepareTransferBuffer,
            renderMaskBegin,
            renderMaskEnd,
            usePipeline,
            renderInstance,
        };
    }

    return {
        name: 'SDFRectPainter',
        generateRender,
        generateTextureRender,
    }
}

export default SDFRectPainter;