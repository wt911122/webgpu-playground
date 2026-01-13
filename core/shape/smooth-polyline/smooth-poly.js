import { JOINT_TYPE, VertsByJoint } from './const';
import polylineShader from './smooth.wgsl?raw';
import { paddingMat3, copyMat3 } from '../../utils/transform';

const Location = {
  PREV : 1,
  POINTA : 2,
  POINTB : 3,
  NEXT : 4,
  VERTEX_JOINT : 5,
  TRAVEL : 6,
}

const VertexBufferOffsets = {
    [Location.PREV]: 0,
    [Location.POINTA]: 4*2,
    [Location.POINTB]: 4*4,
    [Location.NEXT]: 4*6,
    [Location.VERTEX_JOINT]: 4*8,
    [Location.TRAVEL]: 4*9,
}
const strideFloats = 10;
const eps = 0.0001;
const eps2 = eps*eps;
function SmoothPolyPainter() {
    const MAX_OBJECTS = 30000;
    const MAX_SEGMENTS = 100000;

    function generateRender(context) {

        const _objectInfos = [];
        const device = context.device;
        const shapeProgram = device.createShaderModule({
            code: polylineShader,
        });

        const vertexBufferLayout = {
            arrayStride: strideFloats * 4, // 每个顶点的字节大小
            attributes: [
                {
                    format: 'float32x2', // prev: vec2f
                    offset: 0,
                    shaderLocation: 1, // @location(1)
                },
                {
                    format: 'float32x2', // pointA: vec2f
                    offset: 8,
                    shaderLocation: 2, // @location(2)
                },
                {
                    format: 'float32x2', // pointB: vec2f
                    offset: 16,
                    shaderLocation: 3, // @location(3)
                },
                {
                    format: 'float32x2', // next: vec2f
                    offset: 24,
                    shaderLocation: 4, // @location(4)
                },
                {
                    format: 'float32',   // joint: f32
                    offset: 32,
                    shaderLocation: 5, // @location(5)
                },
                {
                    format: 'float32',   // travel: f32
                    offset: 36,
                    shaderLocation: 6, // @location(6)
                },
            ],
        };

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
                buffers: [vertexBufferLayout],
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
            const { 
                bufFloat, indices, bufferPos, indexPos,
            } = preparePointsBuffer(
                path, 
                JOINT_TYPE.JOINT_BEVEL,
                JOINT_TYPE.CAP_BUTT); 

                console.log(bufFloat, indices)
            const lastInstanceCount = config.getPainterConfig('InstanceCount');
            const currInstanceCount = bufferPos;
            config.setPainterConfig('InstanceCount', indexPos);

            if(lastInstanceCount !== currInstanceCount ) {
                const segbuffer = config.getBuffer('SegmentBuffer');
                if(segbuffer) {
                    segbuffer.destroy();
                } 
                config.addBuffer('SegmentBuffer', createFloatBufferAtCreate(
                    'SegmentBuffer', device,
                    GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
                    bufFloat))
                

                const indicebuffer = config.getBuffer('IndiceBuffer');
                if(indicebuffer) {
                    indicebuffer.destroy();
                }
                config.addBuffer('IndiceBuffer', createUnit16BufferAtCreate(
                    'IndiceBuffer', device,
                    GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
                    indices))
            

            } else {
                const segbuffer = config.getBuffer('SegmentBuffer');
                device.queue.writeBuffer(segbuffer, 0, new Float32Array(bufFloat));
                const indicebuffer = config.getBuffer('IndiceBuffer');
                device.queue.writeBuffer(indicebuffer, 0, new Float32Array(indices));
            }
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
                console.log(materialValue)
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
                const InstanceCount = conf.getPainterConfig('InstanceCount');
                const IndicesBuffer = conf.getBuffer('IndiceBuffer');
                passEncoder.setIndexBuffer(IndicesBuffer, 'uint16');
                passEncoder.setVertexBuffer(0, SegmentBuffer);
                
                passEncoder.setBindGroup(0, globalBindGroup);  
                passEncoder.setBindGroup(1, _objectInfos[idx]);  
                passEncoder.drawIndexed(InstanceCount);
            });

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
        name: 'SmoothPolyline',
        generateRender,
    }
}


export default SmoothPolyPainter;


function preparePointsBuffer(
    points, 
    jointType, 
    capType, 
) {
    if(Array.isArray(points[0])) {
        return _preparePointsBuffer(points[0], jointType, capType) 
    } else {
        return _preparePointsBuffer(points, jointType, capType)
    }
}
function _preparePointsBuffer(
    points, 
    jointType, 
    capType, 
) {
    let len = points.length;
    let newLen = 2;

    // 1. remove equal points
    for (let i = 2; i < len; i += 2)
    {
        const x1 = points[i - 2];
        const y1 = points[i - 1];
        const x2 = points[i];
        const y2 = points[i + 1];
        let flag = true;

        if (Math.abs(x1 - x2) < eps
            && Math.abs(y1 - y2) < eps)
        {
            flag = false;
        }

        if (flag)
        {
            points[newLen] = points[i];
            points[newLen + 1] = points[i + 1];
            newLen += 2;
        }
    }
    points.length = len = newLen;

    newLen = 2;
    // 2. remove middle points
    for (let i = 2; i + 2 < len; i += 2)
    {
        let x1 = points[i - 2];
        let y1 = points[i - 1];
        const x2 = points[i];
        const y2 = points[i + 1];
        let x3 = points[i + 2];
        let y3 = points[i + 3];

        x1 -= x2;
        y1 -= y2;
        x3 -= x2;
        y3 -= y2;
        let flag = true;

        if (Math.abs((x3 * y1) - (y3 * x1)) < eps2)
        {
            if ((x1 * x3) + (y1 * y3) < -eps2)
            {
                flag = false;
            }
        }

        if (flag)
        {
            points[newLen] = points[i];
            points[newLen + 1] = points[i + 1];
            newLen += 2;
        }
    }
    points[newLen] = points[len - 2];
    points[newLen + 1] = points[len - 1];
    newLen += 2;

    points.length = len = newLen;

    const verts = [];
    const joints = [];
    const joint = jointType;
    const cap = capType;
    let prevCap = 0;

    let prevX; 
    let prevY;

    prevX = points[2];
    prevY = points[3];
    if (cap === JOINT_TYPE.CAP_ROUND)
    {
        verts.push(points[0], points[1]);
        joints.push(JOINT_TYPE.NONE);
        joints.push(JOINT_TYPE.CAP_ROUND);
        prevCap = 0;
    }
    else
    {
        prevCap = cap;
        joints.push(JOINT_TYPE.NONE);
    }

    verts.push(prevX, prevY);
    for (let i = 0; i < len; i += 2) {
        const x1 = points[i]; 
        const y1 = points[i + 1];
        let endJoint = joint;

        if (i + 2 >= len) {
            endJoint = JOINT_TYPE.NONE;
        } else if (i + 4 >= len) {
            if (cap === JOINT_TYPE.CAP_ROUND) {
                endJoint = JOINT_TYPE.JOINT_CAP_ROUND;
            }
            if (cap === JOINT_TYPE.CAP_BUTT) {
                endJoint = JOINT_TYPE.JOINT_CAP_BUTT;
            }
            if (cap === JOINT_TYPE.CAP_SQUARE) {
                endJoint = JOINT_TYPE.JOINT_CAP_SQUARE;
            }
        }

        endJoint += prevCap;
        prevCap = 0;

        verts.push(x1, y1);
        joints.push(endJoint);

        prevX = x1;
        prevY = y1;
    }

    verts.push(points[len - 4], points[len - 3]);
    joints.push(JOINT_TYPE.NONE);

    let foundTriangle = false;
    
    let vertexSize = 0;
    let indexSize = 0;

    for (let i = 0; i < joints.length; i++)
    {
        const prevCap = joints[i] & ~31;
        const joint = joints[i] & 31;

        if (joint >= JOINT_TYPE.FILL_EXPAND)
        {
            vertexSize += 3;
            indexSize += 3;
            continue;
        }

        const vs = VertsByJoint[joint] + VertsByJoint[prevCap];

        if (vs >= 4)
        {
            vertexSize += vs;
            indexSize += 6 + (3 * Math.max(vs - 6, 0));
        }
    }
    const floatsSize = vertexSize * strideFloats;
    const arrBuf = new ArrayBuffer(floatsSize * 4);
    const bufFloat = new Float32Array(arrBuf);
    const indices = new Uint32Array(indexSize);
    let bufPos = 0;
    let indPos = 0;
    let index = 0;
    let travel = 0;

    let x1; let y1;
    let x2; let y2;
    let nextX; let nextY;

    for (let j = 0; j < joints.length; j++) {
        const fullJoint = joints[j];
        const prevCap = joints[j] & ~31;
        const joint = joints[j] & 31;

        if (joint >= JOINT_TYPE.FILL_EXPAND) {
            prevX = verts[j * 2];
            prevY = verts[(j * 2) + 1];
            x1 = verts[(j * 2) + 2];
            y1 = verts[(j * 2) + 3];
            x2 = verts[(j * 2) + 4];
            y2 = verts[(j * 2) + 5];

            const bis = j + 3;

            for (let i = 0; i < 3; i++) {
                bufFloat[bufPos] = prevX;
                bufFloat[bufPos + 1] = prevY;
                bufFloat[bufPos + 2] = x1;
                bufFloat[bufPos + 3] = y1;
                bufFloat[bufPos + 4] = x2;
                bufFloat[bufPos + 5] = y2;
                bufFloat[bufPos + 6] = verts[(bis + i) * 2];
                bufFloat[bufPos + 7] = verts[((bis + i) * 2) + 1];

                bufFloat[bufPos + 8] = (16 * fullJoint) + i;
                bufFloat[bufPos + 9] = travel;
                bufPos += strideFloats;
            }

            indices[indPos] = index;
            indices[indPos + 1] = index + 1;
            indices[indPos + 2] = index + 2;
            indPos += 3;
            index += 3;
            continue;
        }

        const vs = VertsByJoint[joint] + VertsByJoint[prevCap];

        if (vs === 0) {
            continue;
        }
        x1 = verts[j * 2];
        y1 = verts[(j * 2) + 1];
        x2 = verts[(j * 2) + 2];
        y2 = verts[(j * 2) + 3];
        // TODO: caps here
        prevX = verts[(j * 2) - 2];
        prevY = verts[(j * 2) - 1];

        const dist = Math.sqrt(((x2 - x1) * (x2 - x1)) + ((y2 - y1) * (y2 - y1)));

        if (VertsByJoint[joint] === 0) {
            travel -= dist;
        }

        if ((joint & ~2) !== JOINT_TYPE.JOINT_CAP_BUTT)
        {
            nextX = verts[(j * 2) + 4];
            nextY = verts[(j * 2) + 5];
        }
        else
        {
            nextX = x1;
            nextY = y1;
        }
        // type = joint;

        for (let i = 0; i < vs; i++)
        {
            bufFloat[bufPos] = prevX;
            bufFloat[bufPos + 1] = prevY;
            bufFloat[bufPos + 2] = x1;
            bufFloat[bufPos + 3] = y1;
            bufFloat[bufPos + 4] = x2;
            bufFloat[bufPos + 5] = y2;
            bufFloat[bufPos + 6] = nextX;
            bufFloat[bufPos + 7] = nextY;
            bufFloat[bufPos + 8] = (16 * fullJoint) + i;
            bufFloat[bufPos + 9] = travel;
            bufPos += strideFloats;
        }

        travel += dist;

        indices[indPos] = index;
        indices[indPos + 1] = index + 1;
        indices[indPos + 2] = index + 2;
        indices[indPos + 3] = index;
        indices[indPos + 4] = index + 2;
        indices[indPos + 5] = index + 3;
        indPos += 6;
        for (let j = 5; j + 1 < vs; j++)
        {
            indices[indPos] = index + 4;
            indices[indPos + 1] = index + j;
            indices[indPos + 2] = index + j + 1;
            indPos += 3;
        }
        index += vs;
    }

    return {
        bufFloat, indices, bufferPos: bufPos, indexPos: indPos,
    }
}




const roundUp = (v, alignment) => Math.ceil(v / alignment) * alignment;
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