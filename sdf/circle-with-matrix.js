import { mat3, vec2 } from 'gl-matrix';
import vertexShader from './vertext-with-matrix.wgsl?raw';
import fragmentShader from './circle.wgsl?raw';

import netbgVertexShader from './net-bg-vertex.wgsl?raw';
import netbgFragmentShader from './net-bg-fragment.wgsl?raw';

function paddingMat3(matrix) {
    return [
        matrix[0],
        matrix[1],
        matrix[2],
        0,
        matrix[3],
        matrix[4],
        matrix[5],
        0,
        matrix[6],
        matrix[7],
        matrix[8],
        0,
    ];
}


function Camera() {
    let _zoom = 1;
    let _x = 0;
    let _y = 0;

    const matrix = mat3.create();
    const projectionMatrix = mat3.create();
    const viewMatrix = mat3.create();
    const viewProjectionMatrix = mat3.create();
    const viewProjectionMatrixInv = mat3.create();

    function projection(width, height) {
        mat3.projection(projectionMatrix, width, height);
    }

    function update() {
        const zoomScale = 1 / _zoom;
        mat3.identity(matrix);
        mat3.translate(matrix, matrix, [_x, _y]);
        mat3.scale(matrix, matrix, [zoomScale, zoomScale]);
        mat3.invert(viewMatrix, matrix);
        updateViewProjectionMatrix();
    }

    function updateViewProjectionMatrix() {
        mat3.multiply(viewProjectionMatrix, projectionMatrix, viewMatrix)
        mat3.invert(viewProjectionMatrixInv, viewProjectionMatrix);
    }

    function getProjection() {
        return paddingMat3(projectionMatrix)
    }

    function translate(x, y) {
        _x = x;
        _y = y;
        update();
    }

    function pan(deltaX, deltaY) {
        _x += deltaX;
        _y += deltaY;
        update();
    }

    function zoom(s) {
        _zoom = s;
        update();
    }

    function setMatrix(x, y, zoom) {
        _x = x;
        _y = y;
        _zoom = zoom;
    } 

    // function writeBuffer() {
    //     const buffer = new ArrayBuffer(_buffer.size);
    //     new Float32Array(buffer).set(projectionMatrix);
    //     new Uint32Array(buffer, 16 * Float32Array.BYTES_PER_ELEMENT).set([
    //         averageLayersPerFragment * canvas.width * sliceHeight,
    //         canvas.width,
    //     ]);
    // }

    function read() {
        console.log(matrix, projectionMatrix, viewMatrix, viewProjectionMatrix, viewProjectionMatrixInv)
    }

    function getProjectMatrix() {
        return projectionMatrix;
    }
    function getViewMatrix() {
        return viewMatrix;
    }
    function getViewProjectMatrixInv() {
        return viewProjectionMatrixInv
    }
    // function viewport2Canvas(x, y) {
    //     const { width, height, viewProjectionMatrixInv } = camera || this;
    //     const canvasCoord = vec2.transformMat3(
    //         vec2.create(),
    //         [(x / width) * 2 - 1, (1 - y / height) * 2 - 1],
    //         viewProjectionMatrixInv,
    //     );
    //     return canvasCoord;
    // }

    // function canvas2Viewport(x, y) {
    //     const { width, height, viewProjectionMatrix } = camera || this;
    //     const clip = vec2.transformMat3(
    //         vec2.create(),
    //         [x, y],
    //         viewProjectionMatrix,
    //     );
    //     return {
    //     x: ((clip[0] + 1) / 2) * width,
    //     y: (1 - (clip[1] + 1) / 2) * height,
    //     };
    // }

    return {
        projection,
        getProjection,
        pan, 
        zoom,
        getZoom() {
            return _zoom;
        },
        read,
        getProjectMatrix,
        getViewMatrix,
        update,
        setMatrix,
        getViewProjectMatrixInv
    }
}


async function init() {
    const adapter = await navigator.gpu.requestAdapter();
    const device = await adapter.requestDevice();

    const WIDTH = 800;
    const HEIGHT = 600;
    const canvas = document.createElement('canvas');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    document.getElementById('app').append(canvas);
    const context = canvas.getContext('webgpu');

    const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
    context.configure({
        device,
        format: presentationFormat,
        alphaMode: 'premultiplied'
    })

    const CAM = Camera();
    CAM.projection(WIDTH, HEIGHT);

    CAM.pan(-100, -200);
    CAM.zoom(0.5)

    console.log(CAM.read())
    // const 

    const uniformBuffer = device.createBuffer({
        size: 12 * Float32Array.BYTES_PER_ELEMENT * 3 + Float32Array.BYTES_PER_ELEMENT * 4,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        label: 'uniformBuffer',
    }); 

    // const buffer = new ArrayBuffer(uniformBuffer.size);
    // const buffer = new Float32Array([
    //     ...paddingMat3(CAM.getProjectMatrix()),
    //     ...paddingMat3(CAM.getViewMatrix()),
    //     ...paddingMat3(CAM.getViewProjectMatrixInv()),
    //     CAM.getZoom(),
    // ]);
    // device.queue.writeBuffer(uniformBuffer, 0, buffer);

    // Vertex Buffer
    const Vertex = new Float32Array([
        -1, 1,
        1, 1,
        -1, -1,

        -1, -1, 
        1, 1, 
        1, -1
    ]);
    const VertexBuffer = device.createBuffer({
        label: 'Vertex',
        size: Vertex.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });

    device.queue.writeBuffer(VertexBuffer, 0, Vertex);

    // Circle Buffer 
    const Circle = new Float32Array([
        100, 100, // cx, cy,
        100, // rx, ry,
    ]);
    const CircleBuffer = device.createBuffer({
        label: 'Vertex',
        size: Circle.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });

    device.queue.writeBuffer(CircleBuffer, 0, Circle);

    const numVertices = 6;
    const kNumObjects = 1;

    const renderPipeline = device.createRenderPipeline({
        label: 'circle pipeline',
        layout: 'auto',
        vertex: {
            module: device.createShaderModule({
                code: vertexShader,
            }),
            entryPoint: "main",
            buffers: [
                {
                    arrayStride: 2 * 4,
                    attributes: [
                        { shaderLocation: 0, offset: 0, format: 'float32x2' },
                    ],
                    stepMode: "vertex"
                },
                {
                    arrayStride: 3 * 4,
                    attributes: [
                        { shaderLocation: 1, offset: 0, format: 'float32x2' },
                        { shaderLocation: 2, offset: 4, format: 'float32x2' },
                    ],
                    stepMode: "instance"
                }
            ]
        },
        fragment: {
            module: device.createShaderModule({
                code: fragmentShader
            }),
            targets: [{ format: presentationFormat, }],
        },
    })

    const bindGroup = device.createBindGroup({
        label: 'bindingGroup',
        layout: renderPipeline.getBindGroupLayout(0),
        entries: [
            { 
                binding: 0, 
                resource: { 
                    buffer: uniformBuffer,
                } 
            },
        ],
    });


    const renderGridPipeline = device.createRenderPipeline({
        label: 'grid pipeline',
        layout: 'auto',
        vertex: {
            module: device.createShaderModule({
                code: netbgVertexShader,
            }),
            entryPoint: "main",
            buffers: [
                {
                    arrayStride: 2 * 4,
                    attributes: [
                        { shaderLocation: 0, offset: 0, format: 'float32x2' },
                    ],
                    stepMode: "vertex"
                }
            ]
        },
        fragment: {
            module: device.createShaderModule({
                code: netbgFragmentShader
            }),
            targets: [{ format: presentationFormat, }],
        },
    })

    const bindGridGroup = device.createBindGroup({
        label: 'bindingGroup',
        layout: renderGridPipeline.getBindGroupLayout(0),
        entries: [
            { 
                binding: 0, 
                resource: { 
                    buffer: uniformBuffer,
                } 
            },
        ],
    });

    
    // const encoder = device.createCommandEncoder();
    // const passEncoder = encoder.beginRenderPass({
    //     colorAttachments: [
    //         {
    //             clearValue: { r: 0.0, g: 0.5, b: 1.0, a: 1.0},
    //             loadOp: "clear",
    //             storeOp: "store",
    //             view: context.getCurrentTexture().createView()
    //         }
    //     ]
    // });
    // passEncoder.setPipeline(renderPipeline);
    // passEncoder.setVertexBuffer(0, VertexBuffer);
    // passEncoder.setVertexBuffer(1, CircleBuffer);
    // passEncoder.setBindGroup(0, bindGroup);
    // passEncoder.draw(numVertices, kNumObjects)
    // passEncoder.end();
    
    // const commandBuffer = encoder.finish();
    // device.queue.submit([commandBuffer]);

    function render () {
        const buffer = new Float32Array([
            ...paddingMat3(CAM.getProjectMatrix()),
            ...paddingMat3(CAM.getViewMatrix()),
            ...paddingMat3(CAM.getViewProjectMatrixInv()),
            CAM.getZoom(),
        ]);
        device.queue.writeBuffer(uniformBuffer, 0, buffer);
        const encoder = device.createCommandEncoder();
        const passEncoder = encoder.beginRenderPass({
            colorAttachments: [
                {
                    clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 0.0},
                    loadOp: "clear",
                    storeOp: "store",
                    view: context.getCurrentTexture().createView()
                }
            ]
        });
        if(CAM.getZoom() > 1.5) {
            passEncoder.setPipeline(renderGridPipeline);
            passEncoder.setVertexBuffer(0, VertexBuffer);
            passEncoder.setBindGroup(0, bindGridGroup);
            passEncoder.draw(6);
        }



        passEncoder.setPipeline(renderPipeline);
        passEncoder.setVertexBuffer(0, VertexBuffer);
        passEncoder.setVertexBuffer(1, CircleBuffer);
        passEncoder.setBindGroup(0, bindGroup);
        passEncoder.draw(numVertices, kNumObjects)
        passEncoder.end();
        device.queue.submit([encoder.finish()]);

    }
    render();

    let __clock__ = Date.now();
    function scheduleRender() {
        requestAnimationFrame((timestamp) => {
            const isFirstTime = __clock__ !== timestamp
            if(isFirstTime) {
                render();
            }
            __clock__ = timestamp;
        })
    }

    const resolution = WIDTH/HEIGHT;
    function panHandler(deltaX, deltaY) {

        CAM.pan(deltaX, deltaY*resolution);
        scheduleRender();
    }


    function zoomHandler(offsetX, offsetY, deltaX, deltaY) {
        const normalizedX = offsetX / canvas.clientWidth;
        const normalizedY = offsetY / canvas.clientHeight;

        // convert to clip space
        const clipX = normalizedX * 2 - 1;
        const clipY = normalizedY * -2 + 1;
        const position = [clipX, clipY];

        const [preZoomX, preZoomY] = vec2.transformMat3(
            vec2.create(),
            position,
            CAM.getViewProjectMatrixInv(),
        );

        const newZoom = CAM.getZoom() * Math.pow(2, deltaY * -0.01);
        CAM.zoom(newZoom);
        
        const [postZoomX, postZoomY] = vec2.transformMat3(
            vec2.create(),
            position,
            CAM.getViewProjectMatrixInv(),
        );

        CAM.pan(preZoomX - postZoomX, preZoomY - postZoomY);
        scheduleRender();
    }

    canvas.addEventListener('wheel', (event) => {
        event.preventDefault();
        let { offsetX, offsetY, deltaX, deltaY } = event
        if(event.ctrlKey) { 
            // deltaY = -deltaY;
            zoomHandler(offsetX, offsetY, deltaX, deltaY, event);
        } else {
            panHandler(deltaX, deltaY, event);
        }
    })
}

init();

