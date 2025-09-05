import { STRIDE_POINT, JOINT_TYPE } from './enums';
import polylineShader from './polyline.wgsl?raw';
import roundJointShader from './roundjoint.wgsl?raw';
import { createBufferWithData } from '../../utils/buffer';
import PolyLine from '../../instance/polyline';
import { paddingMat3, copyMat3 } from '../../utils/transform';

function PolylinePainter() {
    const VERTEX_ARRAY =[
        0, -0.5, 
        1, -0.5, 
        1, 0.5,
        0, -0.5,
        1,  0.5,
        0,  0.5
    ]
    const MAX_OBJECTS = 3000;
    const AVERAGE_LINE_SEGMENT_PER_OBJECT = 20;
    const roundUp = (v, alignment) => Math.ceil(v / alignment) * alignment;

    const JOINT_VERTEX_ARRAY = new Float32Array([
        -1, -1, 1, -1, 1, 1, -1, 1
    ]);
    const JOINT_INDICES_ARRAY = new Uint16Array([
        0, 1, 2, 0, 2, 3
    ]);

    function _genJointRender(device) {
        const roundJointProgram = device.createShaderModule({
            code: roundJointShader
        })
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
                    buffer: { type: 'uniform', minBindingSize: 80 },
                },
            ],
        })

        const pipelineLayout = device.createPipelineLayout({
            bindGroupLayouts: [ bindGroupLayout ],
        });

        const renderPipeline = device.createRenderPipeline({
            layout: pipelineLayout,
            vertex: {
                module: roundJointProgram,
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
                module: roundJointProgram,
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
        return {
            renderPipeline,
            bindGroupLayout
        }
    }

    function generateRender(context) {
        const _objectInfos = [];
        const device = context.device;
        const shapeProgram = device.createShaderModule({
            code: polylineShader,
        });

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
                    buffer: { type: 'uniform', minBindingSize: 96 },
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
                    {
                        arrayStride: 4 * 4,
                        attributes: [
                            { shaderLocation: 1, offset: 0, format: 'float32x2' },
                            { shaderLocation: 2, offset: 4 * 2, format: 'float32x2' },
                        ],
                        stepMode: "instance"
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

        const MATIRIAL_OFFSET = 0;
        const TRAN_OFFSET = 12;
        const uniformBufferSize = (4 + 4 + 4 + 12) * 4; // zindex, strokeWidth, fill, stroke, transformMat
       
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
            _objectInfos.push({
                bindGroup
            })
        }

        function afterCollectConfig(instance, config) {
            const {
                points, joints, segments, _strokeWidth, _zIndex, mat, _colors,
            } = config;
            
            config._pointsBuffer = createFloatBufferAtCreate(
                '_pointsBuffer', device,
                points.length * Float32Array.BYTES_PER_ELEMENT,
                GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
                points);
            
            const vertex = new Array(segments).fill(VERTEX_ARRAY).flat();
            config._vertextBuffer = createFloatBufferAtCreate(
                '_vertextBuffer', device,
                segments * 12 * Float32Array.BYTES_PER_ELEMENT,
                GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
                vertex);
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
             console.log(numObjects)
            /*passEncoder.setPipeline(jointRenderer.renderPipeline);
           
            for (let i = 0; i < numObjects; ++i) {
                const {
                    bindGroup,
                } = _objectInfos[i];
                const config = configs[i];
                if(config._jointCount > 0) {
                    const jointBindings = config._jointBindings;
                    passEncoder.setVertexBuffer(0, JointVertexBuffer);
                    passEncoder.setIndexBuffer(JointIndicesBuffer, 'uint16');
                    console.log(config._jointCount)
                    // for (let i = 0; i < config._jointCount; ++i) {
                        passEncoder.setBindGroup(0, jointBindings[1]);   
                        passEncoder.drawIndexed(6, 1);
                    // }
                }

            }*/

            passEncoder.setPipeline(renderShapePipeline);
            for (let i = 0; i < numObjects; ++i) {
                const {
                    bindGroup,
                } = _objectInfos[i];
                const config = configs[i];
                const {
                    points, segments, _strokeWidth, _zIndex, mat, _colors,
                } = config;
                const uniformBufferOffset = i * uniformBufferSpace;
                const f32Offset = uniformBufferOffset / 4;
                const materialValue = uniformValues.subarray(
                    f32Offset + MATIRIAL_OFFSET, 
                    f32Offset + TRAN_OFFSET);
                const shapeMatrixValue = uniformValues.subarray(
                    f32Offset + TRAN_OFFSET, 
                    f32Offset + TRAN_OFFSET + 12);
                materialValue[0] = _zIndex;
                materialValue[1] = _strokeWidth;
                materialValue[4] = _colors[0];
                materialValue[5] = _colors[1];
                materialValue[6] = _colors[2];
                materialValue[7] = _colors[3];
                materialValue[8] = _colors[4];
                materialValue[9] = _colors[5];
                materialValue[10] = _colors[6];
                materialValue[11] = _colors[7];
                copyMat3(shapeMatrixValue, mat);
                console.log(segments)
                passEncoder.setVertexBuffer(0, config._vertextBuffer);
                passEncoder.setVertexBuffer(1, config._pointsBuffer);
                passEncoder.setBindGroup(0, bindGroup);   
                passEncoder.draw(segments * 6, segments);
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
            afterCollectConfig,
        };
    }

    return {
        generateRender,
        Ctor: [PolyLine]
    }
}

export default PolylinePainter;

function getJointType(lineJoin) {
    let joint;

    switch (lineJoin) {
        case 'bevel':
            joint = JointType.JOINT_BEVEL;
        break;
        case 'round':
            joint = JointType.JOINT_ROUND;
        break;
        default:
            joint = JointType.JOINT_MITER;
        break;
    }

    return joint;
}


function getCapType(lineCap) {
    let cap;

    switch (lineCap) {
        case 'square':
            cap = JointType.CAP_SQUARE;
        break;
        case 'round':
            cap = JointType.CAP_ROUND;
        break;
        default:
            cap = JointType.CAP_BUTT;
        break;
    }

    return cap;
}


function createFloatBufferAtCreate(label, device, size, usage, arr) {
    const buffer = device.createBuffer({
        label,
        size,
        usage,
        mappedAtCreation: true,
    });
    const t = new Float32Array(buffer.getMappedRange());
    t.set(arr);
    buffer.unmap();
    return buffer;
}
function createUnit16BufferAtCreate(label, device, size, usage, arr) {
    const buffer = device.createBuffer({
        label,
        size,
        usage,
        mappedAtCreation: true,
    });
    const t = new Uint16Array(buffer.getMappedRange());
    t.set(arr);
    buffer.unmap();
    return buffer;
}