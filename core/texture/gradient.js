import { BaseTexture } from './texture';


function getCanvas(width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');

    return { canvas, context };
}

class Canvas2DTexture extends BaseTexture {
    _canvasInstance = undefined;
    _render = undefined;

    get source() {
        return this._canvasInstance.canvas;
    }
    
    constructor(w, h, configs = {}) {
        super(w, h, configs);
        this._canvasInstance = getCanvas(w, h);
        this._render = configs.render;
    }

    update(options) {
        this._options = options;
        this._isDirty = true;
        this._render(options, this._canvasInstance)
    }
}



const emptyColorStops = [{ offset: 0, color: 'white' }, { offset: 1, color: 'black' }];
export const defaultLinearOptions = {
    start: { x: 0, y: 0 },
    end: { x: 0, y: 1 },
    colorStops: [],
    textureSpace: 'local',
    type: 'linear',
    textureSize: 256,
    wrapMode: 'clamp-to-edge'
};

export const defaultRadialOptions = {
    center: { x: 0.5, y: 0.5 },
    innerRadius: 0,
    outerRadius: 0.5,
    colorStops: [],
    scale: 1,
    textureSpace: 'local',
    type: 'radial',
    textureSize: 256,
    wrapMode: 'clamp-to-edge'
};
 
export function createLinearGradientTextureCanvas(options) {
    const Canvas2DTextureInstance = new Canvas2DTexture(options.textureSize, 2, {
        render(options, canvasInstance) {
            const { context } = canvasInstance;
            let { x: x0, y: y0 } = options.start;
            let { x: x1, y: y1 } = options.end;

            let dx = x1 - x0;
            let dy = y1 - y0;

            // Determine flip based on original dx/dy and swap coordinates if necessary
            const flip = dx < 0 || dy < 0;

            if (options._wrapMode === 'clamp-to-edge') {
                if (dx < 0) {
                    const temp = x0;
                    x0 = x1;
                    x1 = temp;
                    dx *= -1;
                }
                if (dy < 0) {
                    const temp = y0;
                    y0 = y1;
                    y1 = temp;
                    dy *= -1;
                }
            }
            const colorStops = options.colorStops.length ? options.colorStops : emptyColorStops;
            const defaultSize = options.textureSize;

            context.clearRect(0,0, defaultSize, 2);
            const gradient = !flip
                ? context.createLinearGradient(0, 0, defaultSize, 0)
                : context.createLinearGradient(defaultSize, 0, 0, 0);

            addColorStops(gradient, colorStops);

            context.fillStyle = gradient;
            context.fillRect(0, 0, defaultSize, 2);
        }
    });
    Canvas2DTextureInstance.update(options);

    return Canvas2DTextureInstance;
}

export function createRadialGradientTextureCanvas(options) {

    const Canvas2DTextureInstance = new Canvas2DTexture(options.textureSize, options.textureSize, {
        render(options, canvasInstance) {
            const { context } = canvasInstance;
            const colorStops = options.colorStops.length ? options.colorStops : emptyColorStops;
            const defaultSize = options.textureSize;

            const { x: x0, y: y0 } = options.center;
            const { x: x1, y: y1 } = options.outerCenter ?? options.center;

            const r0 = options.innerRadius;
            const r1 = options.outerRadius;

            const ox = x1 - r1;
            const oy = y1 - r1;

            const scale = defaultSize / (r1 * 2);

            const cx = (x0 - ox) * scale;
            const cy = (y0 - oy) * scale;

            const gradient = context.createRadialGradient(
                cx,
                cy,
                r0 * scale,
                (x1 - ox) * scale,
                (y1 - oy) * scale,
                r1 * scale
            );

            addColorStops(gradient, colorStops);

            context.fillStyle = colorStops[colorStops.length - 1].color;
            context.fillRect(0, 0, defaultSize, defaultSize);

            context.fillStyle = gradient;

            // First translate to center
            context.translate(cx, cy);

            // Then apply rotation
            context.rotate(options.rotation);

            // Then scale2
            context.scale(1, options.scale);

            // Finally translate back, taking scale into account
            context.translate(-cx, -cy);

            context.fillRect(0, 0, defaultSize, defaultSize);
        }
    })
    
    Canvas2DTextureInstance.update(options);

    return Canvas2DTextureInstance;
}

function addColorStops(gradient, colorStops) {
    for (let i = 0; i < colorStops.length; i++)
    {
        const stop = colorStops[i];

        gradient.addColorStop(stop.offset, stop.color);
    }
}



