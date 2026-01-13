import shader from './mesh.wgsl?raw';
import earcut, { flatten } from 'earcut';
import { triangulate } from './tessy'
import { paddingMat3, copyMat3 } from '../../utils/transform';

const roundUp = (v, alignment) => Math.ceil(v / alignment) * alignment;

function MeshPainter() {
    const MAX_OBJECTS = 30000;
   
    function generateRender(context) {
        const _objectInfos = [];
        const device = context.device;
        const shapeProgram = device.createShaderModule({
            code: shader,
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
                    buffer: { type: 'uniform', minBindingSize: 80 },
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

        const uniformBufferSize = 80; // r, zindex, fill, stroke, transformMat
       
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
                path,
            } = config.getConfig();
            const points = preparePointsBuffer(path);
            const vertices = triangulate(points);
            const indices = new Array(vertices.length / 2)
                .fill(undefined)
                .map((_, i) => i);
            // const { vertices, holes, dimensions } = flatten(points);
            // const indices = earcut(vertices, holes, dimensions);

            config.setPainterConfig('IndicesLength', indices.length)
            const indicebuffer = config.getBuffer('IndicesBuffer');
            if(indicebuffer) {
                indicebuffer.destroy();
            } 
            config.addBuffer('IndicesBuffer', createUnit16BufferAtCreate(
                'SegmentBuffer', device,
                GPUBufferUsage.INDEX,
                indices))
            
            const pointsbuffer = config.getBuffer('VertexBuffer');
            if(pointsbuffer) {
                pointsbuffer.destroy();
            }
            config.addBuffer('VertexBuffer', createFloatBufferAtCreate(
                'SegmentBuffer', device,
                GPUBufferUsage.VERTEX,
                vertices))
        }

        function prepareUniformBuffer(encoder, configs, cacheContext) {
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
            let _flag = false;
            for (let i = 0; i < numObjects; ++i) {
                const config = configs[i];
                if(!config.enable) {
                    continue;
                }
                _flag = true;
                const {
                    _zIndex, 
                    mat,
                    _colors, 
                } = config.getConfig();
                const uniformBufferOffset = i * uniformBufferSpace;
                const f32Offset = uniformBufferOffset / 4;
                const materialValue = uniformValues.subarray(
                    f32Offset, 
                    f32Offset + 8);
                const shapeMatrixValue = uniformValues.subarray(
                    f32Offset + 8, 
                    f32Offset + 20);
                materialValue[0] = _zIndex;
                materialValue[4] = _colors[0];
                materialValue[5] = _colors[1];
                materialValue[6] = _colors[2];
                materialValue[7] = _colors[3];
                copyMat3(shapeMatrixValue, mat);
            }
            if(_flag) {
                passEncoder.setPipeline(renderShapePipeline);
                for (let i = 0; i < numObjects; ++i) {
                    const config = configs[i];
                    if(!config.enable) {
                        continue;
                    }
                    const {
                        bindGroup,
                    } = _objectInfos[i];
                    passEncoder.setVertexBuffer(0, config.getBuffer('VertexBuffer'));
                    passEncoder.setIndexBuffer(config.getBuffer('IndicesBuffer'), 'uint16');
                    passEncoder.setBindGroup(0, bindGroup);    
                    passEncoder.drawIndexed(config.getPainterConfig('IndicesLength'), 1);
                }
            }
            transferBuffer.unmap();
        }

        function prepareTransferBuffer(cacheContext) {
            const transferBuffer = cacheContext.transferBuffer
            transferBuffer.mapAsync(GPUMapMode.WRITE).then(() => {
                mappedTransferBuffers.push(transferBuffer);
            });
        }

        return {
            prepareUniformBuffer,
            render, 
            prepareTransferBuffer,
            collecInstanceConfig,
        };
    }

    return {
        name: 'MeshPainter',
        generateRender,
    }
}

export default MeshPainter;

function createFloatBufferAtCreate(label, device, usage, arr, size) {
    const _size = size || roundUp(arr.length * Float32Array.BYTES_PER_ELEMENT, 4);
    const buffer = device.createBuffer({
        label,
        size: _size,
        usage,
        mappedAtCreation: true,
    });
    const t = new Float32Array(buffer.getMappedRange());
    t.set(arr);
    buffer.unmap();
    return buffer;
}

function createUnit16BufferAtCreate(label, device, usage, arr, size) {
    const _size = size || roundUp(arr.length * Uint16Array.BYTES_PER_ELEMENT, 4); 
    const buffer = device.createBuffer({
        label,
        size: _size,
        usage,
        mappedAtCreation: true,
    });
    const t = new Uint16Array(buffer.getMappedRange());
    t.set(arr);
    buffer.unmap();
    return buffer;
}

function preparePointsBuffer(
    points, 
) {
    if(Array.isArray(points[0])) {
        return points.map(p => _preparePointsBuffer(p));
    } else {
        return [
            _preparePointsBuffer(points)
        ]
    }

}

function _preparePointsBuffer(
    incommingpoints, 
) {
    let lastX;
    let lastY;
    const points = [];
    const inpoints = incommingpoints.slice();
    while(inpoints.length) {
        const x = inpoints.shift();
        const y = inpoints.shift();
        if(Math.abs(lastX - x) < 0.00001
            && Math.abs(lastY - y) < 0.00001 ) {
            const l = points.length-1;
            points[l][0] = x;
            points[l][1] = y;
        } else {
            points.push([x, y]);
        }
        lastX = x;
        lastY = y;
    }
    return points;
}