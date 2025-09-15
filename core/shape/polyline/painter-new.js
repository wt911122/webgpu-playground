import { STRIDE_POINT, JOINT_TYPE, ALIGNMENT } from './enums';
import polylineShader from './polyline-next.wgsl?raw';
import { paddingMat3, copyMat3 } from '../../utils/transform';

const Location = {
  BARYCENTRIC : 0,
  PREV : 1,
  POINTA : 2,
  POINTB : 3,
  NEXT : 4,
  VERTEX_JOINT : 5,
  VERTEX_NUM : 6,
  TRAVEL : 7,
}
const roundUp = (v, alignment) => Math.ceil(v / alignment) * alignment;
const stridePoints = 2;
const strideFloats = 3;

function PolylinePainter() {
    const MAX_OBJECTS = 30000;
    const MAX_SEGMENTS = 100000;

    function generateRender(context) {
        const _objectInfos = [];
        const device = context.device;
        const shapeProgram = device.createShaderModule({
            code: polylineShader,
        });

        const vertexBufferOffsets = [0, 4 * 3, 4 * 5, 4 * 6, 4 * 9, 0, 0];
        const vertexBufferDescriptors = [
            {
                arrayStride: 4 * 3,
                stepMode: 'instance',
                attributes: [
                    {
                        format: 'float32x2',
                        offset: 0,
                        shaderLocation: Location.PREV,
                    },
                ],
            },
            {
                arrayStride: 4 * 3,
                stepMode: 'instance',
                attributes: [
                    {
                        format: 'float32x3',
                        offset: 0,
                        shaderLocation: Location.POINTA,
                    },
                ],
            },
            {
                arrayStride: 4 * 3,
                stepMode: 'instance',
                attributes: [
                    {
                        format: 'float32',
                        offset: 0,
                        shaderLocation: Location.VERTEX_JOINT,
                    },
                ],
            },
            {
                arrayStride: 4 * 3,
                stepMode: 'instance',
                attributes: [
                    {
                        format: 'float32x3',
                        offset: 0,
                        shaderLocation: Location.POINTB,
                    },
                ],
            },
            {
                arrayStride: 4 * 3,
                stepMode: 'instance',
                attributes: [
                    {
                        format: 'float32x2',
                        offset: 0,
                        shaderLocation: Location.NEXT,
                    },
                ],
            },
            {
                arrayStride: 4 * 1,
                stepMode: 'vertex',
                attributes: [
                    {
                        format: 'float32',
                        offset: 0,
                        shaderLocation: Location.VERTEX_NUM,
                    },
                ],
            },
            {
                arrayStride: 4 * 1,
                stepMode: 'instance',
                attributes: [
                    {
                        format: 'float32',
                        offset: 0,
                        shaderLocation: Location.TRAVEL,
                    },
                ],
            },
        ]

        const bindGroupLayout = device.createBindGroupLayout({
            label: 'bindGroupLayout',
            entries: [
                { 
                    binding: 0, visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX,
                    buffer: { type: 'uniform', minBindingSize: 160 },
                },
                { 
                    binding: 1, visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX,
                    buffer: { type: 'uniform', minBindingSize: 4 },
                },
            ],
        });
        const objBindGroupLayout = device.createBindGroupLayout({
            label: 'objBindGroupLayout',
            entries: [
                { 
                    binding: 0, visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX,
                    buffer: { type: 'uniform', minBindingSize: 96 },
                },
            ],
        });
        const pipelineLayout = device.createPipelineLayout({
            label: 'pipelineLayout',
            bindGroupLayouts: [ bindGroupLayout, objBindGroupLayout ],
        });

        const renderPipeline = device.createRenderPipeline({
            label: 'polyline render pipeline',
            layout: pipelineLayout,
            vertex: {
                module: shapeProgram,
                entryPoint: "vs",
                buffers: vertexBufferDescriptors,
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
            primitive: {
                // topology: "triangle-list",
            },
            depthStencil: {
                depthWriteEnabled: true,
                depthCompare: 'less',
                format: 'depth24plus',
            },
        })

        const uniformBufferSize = 96; // r, zindex, fill, stroke, transformMat
       
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
            const bg =  device.createBindGroup({
                label: 'objectBindingGroup',
                layout: objBindGroupLayout,
                entries: [
                    { binding: 0, resource: { buffer: uniformBuffer,  offset: uniformBufferOffset, size: uniformBufferSize } },
                ],
            });
            // console.log(uniformBufferOffset, uniformBufferSize)
            _objectInfos.push(bg)
        }

        const IndicesBuffer = createUnit16BufferAtCreate(
            'IndicesBuffer', device,
            GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
            [0,1,2,0,2,3, 4,5,6, 4,6,7, 4,7,8])
        
        const VertexNumBuffer = createFloatBufferAtCreate(
            'VertexNumBuffer', device,
            GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
            [0, 1, 2, 3, 4, 5, 6, 7, 8]);
        
        const globalBindGroup = device.createBindGroup({
            label: 'globalBindGroup',
            layout: bindGroupLayout,
            entries: [
                { binding: 0, resource: { buffer: context.worldUniformBuffer } },
                { binding: 1, resource: { buffer: context.shapeUniformBuffer } },
            ],
        });


        function collecInstanceConfig(instance, config) {
            if(!config.enable) {
                return;
            }
            const { 
                path,
                _strokeAlignment,
                _strokeWidth
            } = config.getConfig();
            const { pointsBuffer, travelBuffer } = preparePointsBuffer(
                path, 
                JointType.JOINT_MITER,
                JointType.JOINT_CAP_BUTT, 
                JointType.CAP_BUTT, _strokeAlignment * _strokeWidth);  
            
            const lastInstanceCount = config.getPainterConfig('InstanceCount');
            const currInstanceCount = pointsBuffer.length / strideFloats - 3
            config.setPainterConfig('InstanceCount', currInstanceCount);

            if(lastInstanceCount !== currInstanceCount ) {
                const segbuffer = config.getBuffer('SegmentBuffer');
                if(segbuffer) {
                    segbuffer.destroy();
                } else {
                    config.addBuffer('SegmentBuffer', createFloatBufferAtCreate(
                        'SegmentBuffer', device,
                        GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
                        pointsBuffer))
                }

                const tvBuffer = config.getBuffer('TravelBuffer');
                if(tvBuffer) {
                    tvBuffer.destroy();
                } else {
                    config.addBuffer('TravelBuffer', createFloatBufferAtCreate(
                        'TravelBuffer', device,
                        GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
                        travelBuffer))
                }

            } else {
                const segbuffer = config.getBuffer('SegmentBuffer');
                device.queue.writeBuffer(segbuffer, 0, new Float32Array(pointsBuffer));
                const tvBuffer = config.getBuffer('TravelBuffer');
                device.queue.writeBuffer(tvBuffer, 0, new Float32Array(travelBuffer));
            }
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
                if(!configs[i].enable) {
                    continue;
                }
                const { 
                    _strokeLineDash,
                    _strokeWidth,
                    _strokeAlignment,
                    _zIndex,
                    _colors,
                    mat,
                } = configs[i].getConfig();
                const uniformBufferOffset = i * uniformBufferSpace;
                const f32Offset = uniformBufferOffset / 4;
                const materialValue = uniformValues.subarray(
                    f32Offset, 
                    f32Offset + 12);
                const shapeMatrixValue = uniformValues.subarray(
                    f32Offset + 12, 
                    f32Offset + 24);
                materialValue[0] = _strokeWidth;
                materialValue[1] = _zIndex;
                materialValue[2] = _strokeAlignment;
                // stroke
                materialValue[4] = _colors[4];
                materialValue[5] = _colors[5];
                materialValue[6] = _colors[6];
                materialValue[7] = _colors[7];
                if(_strokeLineDash.length) {
                    materialValue[8] = _strokeLineDash[0] || 0.0;
                    materialValue[9] = _strokeLineDash[1] || 0.0;
                }
                copyMat3(shapeMatrixValue, mat);
            }

            passEncoder.setPipeline(renderPipeline);
            configs.forEach((conf, idx) => {
                if(!conf.enable) {
                    return;
                }
                const SegmentBuffer = conf.getBuffer('SegmentBuffer');
                const TravelBuffer = conf.getBuffer('TravelBuffer');
                const InstanceCount = conf.getPainterConfig('InstanceCount');

                passEncoder.setIndexBuffer(IndicesBuffer, 'uint16');
                passEncoder.setVertexBuffer(0, SegmentBuffer, vertexBufferOffsets[0]);
                passEncoder.setVertexBuffer(1, SegmentBuffer, vertexBufferOffsets[1]);
                passEncoder.setVertexBuffer(2, SegmentBuffer, vertexBufferOffsets[2]);
                passEncoder.setVertexBuffer(3, SegmentBuffer, vertexBufferOffsets[3]);
                passEncoder.setVertexBuffer(4, SegmentBuffer, vertexBufferOffsets[4]);
                passEncoder.setVertexBuffer(5, VertexNumBuffer, 0);
                passEncoder.setVertexBuffer(6, TravelBuffer, 0);
                
                passEncoder.setBindGroup(0, globalBindGroup);  
                passEncoder.setBindGroup(1, _objectInfos[idx]);  
                passEncoder.drawIndexed(15, InstanceCount);
            });

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
            collecInstanceConfig,
        };
    }

    return {
        name: 'PolylinePainter',
        generateRender,
    }

}

export default PolylinePainter;



const JointType = {
    NONE : 0,
    FILL : 1,
    JOINT_BEVEL : 4,
    JOINT_MITER : 8,
    JOINT_ROUND : 12,
    JOINT_CAP_BUTT : 16,
    JOINT_CAP_SQUARE : 18,
    JOINT_CAP_ROUND : 20,
    FILL_EXPAND : 24,
    CAP_BUTT : 1 << 5,
    CAP_SQUARE : 2 << 5,
    CAP_ROUND : 3 << 5,
    CAP_BUTT2 : 4 << 5,
}

function checkPoints(points) {
    const subPaths = [];
    let lastNaNIndex = 0;
    for (let i = 0; i < points.length; i += stridePoints) {
        if (isNaN(points[i]) || isNaN(points[i + 1])) {
            subPaths.push(points.slice(lastNaNIndex, i));
            lastNaNIndex = i + 2;
        }
    }
    subPaths.push(points.slice(lastNaNIndex));
    return subPaths;
}

function preparePointsBuffer(
    points, 
    jointType, 
    capType, 
    endJoint,
) {
    if(Array.isArray(points[0])) {
        const pointsBuffer = [];
        const travelBuffer = [];
        points.forEach((p, idx) => {
            const r = _preparePointsBuffer(
                p, 
                jointType, 
                capType, 
                endJoint,
            );
            pointsBuffer.push(...r.pointsBuffer);
            if(idx > 0) {
                travelBuffer.push(0, 0);
            }
            travelBuffer.push(...r.travelBuffer);
        });
        return { 
            pointsBuffer,
            travelBuffer,
        }
    } else {
        return _preparePointsBuffer(points, jointType, 
                capType, 
                endJoint,)
    }

}

function _preparePointsBuffer(
    incommingpoints, 
    jointType, 
    capType, 
    endJoint,
) {
    let lastX;
    let lastY;
    const points = [];
    const inpoints = incommingpoints.slice();
    while(inpoints.length) {
        const x = inpoints.shift();
        const y = inpoints.shift();
        if(Math.abs(lastX - x) < Number.EPSILON
            && Math.abs(lastY - y) < Number.EPSILON ) {
            const l = points.length;
            points[l-2] = x;
            points[l-1] = y;
        } else {
            points.push(x, y);
        }
        lastX = x;
        lastY = y;
    }


    const pointsBuffer = [];
    const travelBuffer = [];
    let j = (Math.round(0 / stridePoints) + 1) * strideFloats;
    let dist = 0;


    for (let i = 0; i < points.length; i += stridePoints) {
      // calc travel
      if (i > 1) {
        dist += Math.sqrt(
          Math.pow(points[i] - points[i - stridePoints], 2) +
            Math.pow(points[i + 1] - points[i + 1 - stridePoints], 2),
        );
      }
      travelBuffer.push(dist);
        // travelBuffer.push(i*stridePoints);

      pointsBuffer[j++] = points[i];
      pointsBuffer[j++] = points[i + 1];
      pointsBuffer[j] = jointType;
      if (i == 0) {
        if (capType !== JointType.CAP_ROUND) {
          pointsBuffer[j] += capType;
        }
      } else {
        if (isNaN(points[i - 2]) || isNaN(points[i - 1])) {
          pointsBuffer[j] += JointType.CAP_BUTT;
        }
      }
      if (
        i + stridePoints * 2 >= points.length ||
        isNaN(points[i + 4]) ||
        isNaN(points[i + 5])
      ) {
        pointsBuffer[j] += endJoint - jointType;
      } else if (
        i + stridePoints >= points.length ||
        isNaN(points[i + 2]) ||
        isNaN(points[i + 3])
      ) {
        pointsBuffer[j] = 0;
      }
      j++;
    }
    pointsBuffer[j++] = points[points.length - 4];
    pointsBuffer[j++] = points[points.length - 3];
    pointsBuffer[j++] = 0;
    pointsBuffer[0] = points[2];
    pointsBuffer[1] = points[3];
    pointsBuffer[2] = 0;
    // pointsBuffer[3] = points[2];
    // pointsBuffer[4] = points[3];
    // pointsBuffer[5] = capType === JointType.CAP_ROUND ? capType : 0;

    return { 
        pointsBuffer,
        travelBuffer,
    }
}

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