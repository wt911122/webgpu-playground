import Layer from '../../layer/layer';
import { mat3, vec2 } from 'gl-matrix';
import sdfShader from './sdf.wgsl?raw';
import shadowShader from './shadow.wgsl?raw';
import Ellipse from '../../instance/ellipse';
import Rectangle from '../../instance/rectangle';
// console.log(circleShader)
import { paddingMat3, copyMat3 } from '../../utils/transform';
import { createBufferWithData } from '../../utils/buffer';

function SDFPainter() {
    const BYTE_PER_OBJ_VERTEX = Float32Array.BYTES_PER_ELEMENT * 2 * 8;
    const BYTE_PER_OBJ_INDEX = Uint16Array.BYTES_PER_ELEMENT * 6;
    const BYTE_PER_OBJ_CONFIG = Float32Array.BYTES_PER_ELEMENT * 6;
    const BYTE_PER_OBJ_TRNSFORM = Float32Array.BYTES_PER_ELEMENT * 6;
    const roundUp = (v, alignment) => Math.ceil(v / alignment) * alignment;
    const MAX_OBJECTS = 30000;
    const VERTEX_ARRAY = new Float32Array([
        -1, -1, 1, -1, 1, 1, -1, 1
    ]);
    const INDICES_ARRAY = new Uint16Array([
        0, 1, 2, 0, 2, 3
    ]);

    function generateRender(context) {
        const _objectInfos = [];
        const device = context.device;
        const shapeProgram = device.createShaderModule({
            code: sdfShader,
        });
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
                    buffer: { type: 'uniform', minBindingSize: 160 },
                },
            ],
        });

        const pipelineLayout = device.createPipelineLayout({
            bindGroupLayouts: [ bindGroupLayout ],
        });

        const renderShapePipeline = device.createRenderPipeline({
            label: 'shape pipeline',
            layout: pipelineLayout,
            vertex: {
                module: shapeProgram,
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
                module: shapeProgram,
                entryPoint: "fs",
                targets: [{ 
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
                }],

            },
            depthStencil: {
                depthWriteEnabled: true,
                depthCompare: 'less',
                format: 'depth24plus',
            },
        });

        const renderShadowPipeline = device.createRenderPipeline({
            label: 'rect shadow pipeline',
            layout: pipelineLayout,
            vertex: {
                module: rectShadowProgram,
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
                module: rectShadowProgram,
                entryPoint: "fs",
                targets: [{ 
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
                }],

            },
            depthStencil: {
                depthWriteEnabled: true,
                depthCompare: 'less',
                format: 'depth24plus',
            },
        })

        const MATIRIAL_OFFSET = 0;
        const TRAN_OFFSET = 20;
        const SHADOW_OFFSET = 32;
        const uniformBufferSize = (4 + 4 + 4 + 4 + 4 + 12 + 4 + 4) * 4; // r, zindex, fill, stroke, transformMat
       
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

            let shadowObjecs = [];
            for (let i = 0; i < numObjects; ++i) {
                const config = configs[i];
                if(!config.enable) {
                    continue;
                }
                const {
                    type, x, y, w, h, borderRadius, _strokeWidth, _zIndex, mat,
                    _colors, _shadowOffsetX, _shadowOffsetY, _shadowBlur,
                    _strokeLineDash,
                } = config.getConfig();
                const uniformBufferOffset = i * uniformBufferSpace;
                const f32Offset = uniformBufferOffset / 4;
                const materialValue = uniformValues.subarray(
                    f32Offset + MATIRIAL_OFFSET, 
                    f32Offset + TRAN_OFFSET);
                const shapeMatrixValue = uniformValues.subarray(
                    f32Offset + TRAN_OFFSET, 
                    f32Offset + TRAN_OFFSET + 12);
                // https://webgpufundamentals.org/webgpu/lessons/resources/wgsl-offset-computer.htm
                materialValue[0] = x;
                materialValue[1] = y;
                materialValue[2] = w;
                materialValue[3] = h;

                materialValue[4] = _zIndex;
                materialValue[5] = _strokeWidth;
                materialValue[6] = borderRadius || 0;
                materialValue[7] = type;
                materialValue[8] = _strokeLineDash?.length || 0;
                // fill
                materialValue[12] = _colors[0];
                materialValue[13] = _colors[1];
                materialValue[14] = _colors[2];
                materialValue[15] = _colors[3];
                // stroke
                materialValue[16] = _colors[4];
                materialValue[17] = _colors[5];
                materialValue[18] = _colors[6];
                materialValue[19] = _colors[7];
                copyMat3(shapeMatrixValue, mat);
                // console.log(materialValue)
                if(_shadowBlur) {
                    const shadowValue = uniformValues.subarray(
                        f32Offset + SHADOW_OFFSET, 
                        f32Offset + SHADOW_OFFSET + 8);
                    shadowValue[0] = _shadowBlur;
                    shadowValue[2] = _shadowOffsetX;
                    shadowValue[3] = _shadowOffsetY;
                    shadowValue[4] = _colors[8];
                    shadowValue[5] = _colors[9];
                    shadowValue[6] = _colors[10];
                    shadowValue[7] = _colors[11];
                    shadowObjecs.push(i);
                }
            }
           
            passEncoder.setPipeline(renderShapePipeline);
            passEncoder.setVertexBuffer(0, vertexBuffer);
            passEncoder.setIndexBuffer(indicesBuffer, 'uint16');
            for (let i = 0; i < numObjects; ++i) {
                const config = configs[i];
                if(!config.enable) {
                    continue;
                }
                const {
                    bindGroup,
                } = _objectInfos[i];
                passEncoder.setBindGroup(0, bindGroup);   
                passEncoder.drawIndexed(6, 1);
            }

            if(shadowObjecs.length > 0) {
                passEncoder.setPipeline(renderShadowPipeline);
                passEncoder.setVertexBuffer(0, vertexBuffer);
                passEncoder.setIndexBuffer(indicesBuffer, 'uint16');
                shadowObjecs.forEach(idx => {
                     const {
                        bindGroup,
                    } = _objectInfos[idx];
                    const {
                        type, shadowColor, _shadowBlur,
                    } = configs[idx];
                    if(type == Rectangle.type && _shadowBlur) {
                        passEncoder.setBindGroup(0, bindGroup);   
                        passEncoder.drawIndexed(6, 1);
                    } 
                });
            }

            transferBuffer.unmap();
        }

        function afterRender(cacheContext) {
            const transferBuffer = cacheContext.transferBuffer
            transferBuffer.mapAsync(GPUMapMode.WRITE).then(() => {
                mappedTransferBuffers.push(transferBuffer);
            });
        }
        return {
            beforeRender,
            render, 
            afterRender,
        };
    }
    
    
    return {
        name: 'SDFPainter',
        generateRender,
        // Ctor: [Ellipse, Rectangle]
    }
}

export default SDFPainter;

function isPointInEllipse( 
    x, y,
    cx, cy,
    rx, ry,
) {
  const dx = x - cx;
  const dy = y - cy;
  const squaredDistance = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry);

  return squaredDistance <= 1;
}
