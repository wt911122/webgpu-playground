import { STRIDE_POINT, JOINT_TYPE, ALIGNMENT } from './enums';
import polylineShader from './polyline-next.wgsl?raw';
// import roundJointShader from './roundjoint.wgsl?raw';
import { createBufferWithData } from '../../utils/buffer';
import PolyLine from '../../instance/polyline';
import { paddingMat3, copyMat3 } from '../../utils/transform';
import { vec2 } from 'gl-matrix';

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

    function generateRender(context) {
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
                        format: 'float32x2',
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
                        format: 'float32x2',
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
            entries: [
                { 
                    binding: 0, visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX,
                    buffer: { type: 'uniform', minBindingSize: 96 },
                },
            ],
        });
        const pipelineLayout = device.createPipelineLayout({
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


        function collecInstanceConfig(instance, config) {
            if(!config.enable) {
                return;
            }
            const { 
                path,
                _strokeLineDash,
                _strokeWidth,
                _strokeAlignment,
                _zIndex,
                _colors,
                mat,
            } = config.getConfig();
            const { pointsBuffer, travelBuffer } = preparePointsBuffer(
                path, 
                JointType.JOINT_MITER,
                JointType.JOINT_CAP_BUTT, 
                JointType.CAP_BUTT, _strokeAlignment * _strokeWidth);  
            const lastInstanceCount = config.getPainterConfit('InstanceCount');
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
            
          
            const indicebuffer = config.getBuffer('IndicesBuffer');
            if(!indicebuffer) {
                config.addBuffer('IndicesBuffer', createUnit16BufferAtCreate(
                    'IndicesBuffer', device,
                    GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
                    [0,1,2,0,2,3, 4,5,6, 4,6,7, 4,7,8]
                ))
            }
            const objArray = [
                _strokeWidth, _zIndex, _strokeAlignment, 0.0,
                _colors[4], _colors[5], _colors[6], _colors[7],
                0.0, 0.0, 0.0, 0.0,
                ...mat
            ]
            if(_strokeLineDash.length) {
                objArray[8] = _strokeLineDash[0] || 0.0;
                objArray[9] = _strokeLineDash[1] || 0.0;
            }
            const objBuffer = config.getBuffer('objBuffer');
            if(!objBuffer) {
                const buffer = createFloatBufferAtCreate(
                    'objBuffer', device,
                    GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
                    objArray);
                config.addBuffer('objBuffer', buffer)
                config.addBindGroup('objBufferBindGroup', device.createBindGroup({
                    label: 'bindingGroup',
                    layout: objBindGroupLayout,
                    entries: [
                        { binding: 0, resource: { buffer } },
                    ],
                }))
            } else {
                device.queue.writeBuffer(objBuffer, 0, new Float32Array(objArray));
            }
            // Object.assign(config, { pointsBuffer, travelBuffer });
        } 
        
        const VertexNumBuffer = createFloatBufferAtCreate(
            'VertexNumBuffer', device,
            GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
            [0, 1, 2, 3, 4, 5, 6, 7, 8]);
        
        const bindGroup = device.createBindGroup({
            label: 'bindingGroup',
            layout: bindGroupLayout,
            entries: [
                { binding: 0, resource: { buffer: context.worldUniformBuffer } },
                { binding: 1, resource: { buffer: context.shapeUniformBuffer } },
            ],
        });

        let SegmentBuffer;
        let TravelBuffer;
        let IndicesBuffer;
        let InstanceCount = 0;
        function afterCollectConfig(configs) {
            // const pointsBuffer = [];
            // const travelBuffer = [];
            // // let offset = 0;
            // configs.forEach(config => {
            //     pointsBuffer.push(...config.pointsBuffer);
            //     travelBuffer.push(...config.travelBuffer);
            // });

            // InstanceCount = pointsBuffer.length / strideFloats - 3;
            // console.log('InstanceCount', InstanceCount)
            // if(SegmentBuffer) {
            //     SegmentBuffer.destroy();
            // }
            // SegmentBuffer = createFloatBufferAtCreate(
            //     'SegmentBuffer', device,
            //     GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
            //     pointsBuffer);

            // if(TravelBuffer) {
            //     TravelBuffer.destroy();
            // }
            // TravelBuffer = createFloatBufferAtCreate(
            //     'TravelBuffer', device,
            //     GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
            //     travelBuffer);

            // if(IndicesBuffer) {
            //     IndicesBuffer.destroy();
            // }
            // IndicesBuffer = createUnit16BufferAtCreate(
            //     'IndicesBuffer', device,
            //     GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
            //     [0,1,2,0,2,3, 4,5,6, 4,6,7, 4,7,8]
            // );
        }

        function beforeRender(encoder, configs, cacheContext) {
            
        }

        function render(encoder, passEncoder, configs, cacheContext) {
            passEncoder.setPipeline(renderPipeline);
            configs.forEach(conf => {
                if(!conf.enable) {
                    return;
                }
                const SegmentBuffer = conf.getBuffer('SegmentBuffer');
                const TravelBuffer = conf.getBuffer('TravelBuffer');
                const IndicesBuffer = conf.getBuffer('IndicesBuffer');
                const InstanceCount = conf.getPainterConfit('InstanceCount');
                const objBufferBindGroup = conf.getBindGroup('objBufferBindGroup');
                passEncoder.setIndexBuffer(IndicesBuffer, 'uint16');
                passEncoder.setVertexBuffer(0, SegmentBuffer, vertexBufferOffsets[0]);
                passEncoder.setVertexBuffer(1, SegmentBuffer, vertexBufferOffsets[1]);
                passEncoder.setVertexBuffer(2, SegmentBuffer, vertexBufferOffsets[2]);
                passEncoder.setVertexBuffer(3, SegmentBuffer, vertexBufferOffsets[3]);
                passEncoder.setVertexBuffer(4, SegmentBuffer, vertexBufferOffsets[4]);
                passEncoder.setVertexBuffer(5, VertexNumBuffer, 0);
                passEncoder.setVertexBuffer(6, TravelBuffer, 0);
                
                passEncoder.setBindGroup(0, bindGroup);  
                passEncoder.setBindGroup(1, objBufferBindGroup);  
                passEncoder.drawIndexed(15, InstanceCount);
            });
           
        }

        function afterRender(cacheContext) {
        
        }

        return {
            beforeRender,
            render, 
            afterRender,
            collecInstanceConfig,
            afterCollectConfig,
        };
    }

    return {
        name: 'PolylinePainter',
        generateRender,
        // Ctor: [PolyLine]
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
    strokeAlignment = 0
) {
    const pointsBuffer = [];
    const travelBuffer = [];
    // if(strokeAlignment) {
    //     let v = vec2.create();
    //     for (let i = 0; i < points.length; i += 2) {
    //         if(!points[i+3]){
    //             break;
    //         }
    //         const p1 = points.slice(i, i+2);
    //         const p2 = points.slice(i+2, i+4);
    //         vec2.subtract(v, p1, p2);
    //         vec2.normalize(v, v);
    //         vec2.scale(v, v, strokeAlignment);
    
    //         points[i] -= v[1];
    //         points[i+1] += v[0];
    //         points[i+2] -= v[1];
    //         points[i+3] += v[0];
    //     }
    // }
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