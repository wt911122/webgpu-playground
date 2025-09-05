import { vec2, mat3 } from 'gl-matrix';

import Group from './layer/group';
import { traverse } from './layer/layer';
import { Camera } from './utils/camera';
import { createCanvas } from './utils/canvas';
import { Box } from './utils/box';
import IndexRBush from './utils/indexRBush.js';
import { paddingMat3 } from './utils/transform';
import PainterRegistry from './shape-registry';
import { MatrixStack } from './utils/transform';

class JCanvas extends EventTarget {
    _stage = new Group();
    _viewport = new Box();
    _lockBox = new Box();
    _indexRBush = new IndexRBush();

    _painterRegistry = new PainterRegistry();

    _mousevec = vec2.create();

    get stage() {
        return this._stage;
    }

    get indexRBush() {
        return this._indexRBush;
    }

    get canvas() {
        return this.context?.canvas;
    }

    constructor() {
        super();
        this._stage.jcanvas = this;
    }

    useShape(ctor) {
        const pipeline = ctor.attachPainter();
        const total = pipeline.length;
        pipeline.forEach((painterDesc, idx) => {
            const { 
                ctor, painter, configGetter, condition
            } = painterDesc;

            this._painterRegistry.usePainter(ctor, painter, configGetter, condition, idx, total)
        });
        return (...argus) => {
            const q = new ctor(...argus)
            q.jcanvas = this;
            return q;
        }
    }

    usePainter(painter) {
        const shapePainter = this._painterRegistry.regist(painter());
        return shapePainter;
        // return {
        //     painter: shapePainter,
        //     Ctors: meta.Ctor.map(ctor => {
        //         return (...argus) => {
        //             const q = new ctor(...argus)
        //             q.jcanvas = this;
        //             return q;
        //         }
        //     }),
        // }
    }

    async $mount(dom) {
        const { 
            canvas, 
            ctx, 
            DPR, 
            width: c_width, 
            height: c_height, 
            raw_width,
            raw_height,
            left, top 
        } = createCanvas(dom);
        this._bindMeshAndRender = this.meshAndRender.bind(this);
        const adapter = await navigator.gpu.requestAdapter();
        const device = await adapter.requestDevice();
        // device.addEventListener('uncapturederror', event => {
        //     console.log(event.error.message);
        // });
        const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
        ctx.configure({
            device,
            format: presentationFormat,
            alphaMode: 'premultiplied'
        })

        const camera = Camera();
        camera.projection(c_width, c_height);
        camera.update();
        const worldUniformBuffer = _createWorldUniformBuffer(device);
        const shapeUniformBuffer = _createShapeUniformBuffer(device);

        this.context = {
            canvas,
            ctx,
            camera,
            device,
            width: c_width,
            height: c_height,
            viewport: this._viewport,
            
            worldUniformBuffer,
            shapeUniformBuffer,
            jcanvas: this,
        }

        this.updateViewport();
        this.cacheConfigs();
        this.initPipeline();
        this.render = createScheduleRender(this._render.bind(this));
    }

    initPipeline() {
        this._painterRegistry.iterate((painter, ctor) => {
            painter.init(this.context)
        })
    }

    cacheConfigs() {
        const { canvas, ctx, device } = this.context;
        this._depthTexture = _createDepthTexture(canvas, device);
        // this._renderPassDescriptor = _createRenderPassDescriptor(ctx, depthTexture);
    }

    normalizeVec(x, y) {
        const { width, height } = this.context;
        return vec2.fromValues((x / width) * 2 - 1, (1 - y / height) * 2 - 1)
    }

    viewport2Canvas(x, y, outvec) {
        const viewProjectionMatrixInv = this.context.camera.getViewProjectMatrixInv();
        vec2.transformMat3(
            outvec,
            this.normalizeVec(x, y),
            viewProjectionMatrixInv);
    }

    updateViewport() {
        const { width, height } = this.context;
        const _viewport = this._viewport;
        this.viewport2Canvas(0, 0, _viewport.LT);
        this.viewport2Canvas(width, height, _viewport.RB);
    }

    updateWorldUniform() {
        const { camera, worldUniformBuffer, device } = this.context;
        const buffer = new Float32Array([
            ...paddingMat3(camera.getProjectMatrix()),
            ...paddingMat3(camera.getViewMatrix()),
            ...paddingMat3(camera.getViewProjectMatrixInv()),
            camera.getZoom(),
            camera.getAspectRatio(),
        ]);
        device.queue.writeBuffer(worldUniformBuffer, 0, buffer);
    }

    calculateDownBoundingbox() {
        this._stage.calculateDownBoundingbox(mat3.create())
    }

    lockTarget(offsetX, offsetY) {
        // console.time('lockTarget')
        const _lockBox = this._lockBox;
        const viewProjectionMatrixInv = this.context.camera.getViewProjectMatrixInv();
        const mouseVec = this._mousevec;
        vec2.transformMat3(
            _lockBox.LT,
            this.normalizeVec(offsetX-1, offsetY-1),
            viewProjectionMatrixInv);
        vec2.transformMat3(
            _lockBox.RB,
            this.normalizeVec(offsetX+1, offsetY+1),
            viewProjectionMatrixInv);
        vec2.transformMat3(
            mouseVec,
            this.normalizeVec(offsetX, offsetY),
            viewProjectionMatrixInv);
        const shapes = this.indexRBush.inBound(_lockBox.bounding);
        if(shapes.length) {
            shapes.sort((a, b) => b._zIndex - a._zIndex);
            let shape;
            for(let i=0;i<shapes.length;i++) {
                shape = shapes[i];
                const r = shape.checkHit(mouseVec);
                if(r) {
                    return shape;
                }
            }
            // console.timeEnd('lockTarget')
        }
        // console.timeEnd('lockTarget')
        return null;
    }

    pan(deltaX, deltaY) {
        this.context.camera.pan(deltaX, deltaY);
        this.updateViewport();
        this.dispatchEvent(new CustomEvent('zoompan'));
        this.render();
    }
    
    zoom(offsetX, offsetY, deltaX, deltaY) {
        const position = this.normalizeVec(offsetX, offsetY)
        const camera = this.context.camera;
        const [preZoomX, preZoomY] = vec2.transformMat3(
            vec2.create(),
            position,
            camera.getViewProjectMatrixInv(),
        );

        const newZoom = camera.getZoom() * Math.pow(2, deltaY * -0.01);
        camera.zoom(newZoom);
        
        const [postZoomX, postZoomY] = vec2.transformMat3(
            vec2.create(),
            position,
            camera.getViewProjectMatrixInv(),
        );

        camera.pan(preZoomX - postZoomX, preZoomY - postZoomY, true);
        this.updateViewport();
        this.dispatchEvent(new CustomEvent('zoompan'));
        this.render();
    }

    mesh() {
        const shapeRegistry = this._painterRegistry;
        let zindex = 20;
        // console.time('mesh')
        traverse(this._stage, (instance) => {
            if(instance.renderable) {
                instance._zIndex = zindex++;
                // const painter = this._painterRegistry.get(instance.constructor);
                // if(!painter) {
                //     throw `no painter for ${instance.constructor}`
                // }
               
                if(instance._dirty) {
                    this._painterRegistry.iterate(painter => {
                        const dirty = painter.collectConfig(instance);
                        if(dirty) {
                            painter._dirty = true;
                        }
                    })
                    instance._dirty = false;
                    // painter.collectConfig(instance);
                    // instance._dirty = false;
                    // painter._dirty = true;
                }
            }
        })
        this._painterRegistry.iterate((painter) => {
            if(painter._dirty) {
                painter.afterCollectConfig();
            }
        })
        
        this._zIndexCounter = zindex + 20;
        console.log(this._zIndexCounter)
        this.context.device.queue.writeBuffer(this.context.shapeUniformBuffer, 0, new Float32Array([zindex]));
        // console.timeEnd('mesh')
    }

    meshAndRender() {
        this.mesh();
        this.render();
    }

    _render() {
        this.dispatchEvent(new CustomEvent('beforeRender'))
        this.updateWorldUniform();
        // const shapes = this._culling.inBound(this.context.viewport.bounding)
        const device = this.context.device;
        const encoder = device.createCommandEncoder();
        this._painterRegistry.iterate((painter) => {
            painter.beforeRender(encoder)
        })
        const passEncoder = encoder.beginRenderPass(_createRenderPassDescriptor(this.context.ctx, this._depthTexture));
        // console.log(this._zIndexCounter)
        this._painterRegistry.iterate((painter) => {
            painter.render(encoder, passEncoder)
        })
        passEncoder.end();
        device.queue.submit([encoder.finish()]);
        this._painterRegistry.iterate((painter) => {
            painter.afterRender()
        })
        this.dispatchEvent(new CustomEvent('afterRender'))
    }

    doCollection(instance, layerTransformer, renderCounter) {
        const painter = this._painterRegistry.get(instance.constructor);
        if(!painter) {
            throw `no painter for ${instance.constructor}`
        }

        painter.collect(instance, layerTransformer, renderCounter)
    }
}

export default JCanvas;


function _createDepthTexture(canvas, device) {
    const depthTexture = device.createTexture({
        size: [canvas.width, canvas.height],
        format: 'depth24plus',
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
        label: 'depthTexture',
    });
    return depthTexture;
};

function _createRenderPassDescriptor(ctx, depthTexture) {
    return {
        colorAttachments: [
            {
                view: ctx.getCurrentTexture().createView(),
                clearValue: [0, 0, 0, 0],
                loadOp: "clear",
                storeOp: "store",
            }
        ],
        depthStencilAttachment: {
            view: depthTexture.createView(),
            depthClearValue: 1,
            depthLoadOp: 'clear',
            depthStoreOp: 'store',
        }
    }
}

function _createWorldUniformBuffer(device) {
    return device.createBuffer({
        size: 12 * Float32Array.BYTES_PER_ELEMENT * 3 + Float32Array.BYTES_PER_ELEMENT * 4,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        label: 'worldUniformBuffer',
    }); 
}
function _createShapeUniformBuffer(device) {
    return device.createBuffer({
        size: 1 * Float32Array.BYTES_PER_ELEMENT,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        label: 'shapeUniformBuffer',
    }); 
}

function createScheduleRender(render) {
    let __clock__ = Date.now();
    const t = function () {
        requestAnimationFrame((timestamp) => {
            const isFirstTime = __clock__ !== timestamp
            if(isFirstTime) {
                render();
            }
            __clock__ = timestamp;
            // render();
            // t();
        })
    }

    return t;
}