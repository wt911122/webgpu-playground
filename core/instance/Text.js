import Shape from '../layer/shape';
import { mat3, vec2 } from 'gl-matrix';
import { paddingMat3 } from '../utils/transform';
import { parse } from '../path-utils';

class Text extends Shape {
    _font = undefined;
    _content = '';
    _fontSize = 12;

    _fontPath = [];
    _contentBox = [0,0,0,0]
    constructor(configs) {
        super(configs);
        const { x, y, font, content, fontSize } = configs;
        this._font = font;
        this._content = content;
        this._fontSize = fontSize;
        this._bindFlushFontPath = this.flushFontPath.bind(this);
        mat3.translate(this._localTransform, this._localTransform, [x, y]);
        this.flushFontPath();
    }

    set font(val) {
        this._font = font;
        this.markFontDirty();
    }
    get font() {
        return this._font;
    }
    
    set content(val) {
        this._content = val;
        this.markFontDirty();
    }
    get content() {
        return this._content;
    }

    set fontSize(val) {
        this._fontSize = val;
        this.markFontDirty();
    }
    get fontSize() {
        return this.fontSize;
    }

    flushFontPath() {
        const path = this._font.getPath(this._content, 0, 0, this._fontSize);
        const { x1, y1, x2, y2 } = path.getBoundingBox();
        this._contentBox = [x1, y1, x2, y2];
        let d = '';
        path.commands.forEach(command => {
           if (command.type === 'M' || command.type === 'L') {
                d += command.type + ' ' + command.x.toFixed(3) + ' ' + command.y.toFixed(3);
            } else if (command.type === 'C') {
                d += 'C ' + command.x1.toFixed(3) + ' ' + command.y1.toFixed(3) + ' ' + command.x2.toFixed(3) + ' ' + command.y2.toFixed(3) + ' ' + command.x.toFixed(3) + ' ' + command.y.toFixed(3);
            } else if (command.type === 'Q') {
                d += 'Q ' + command.x1.toFixed(3) + ' ' + command.y1.toFixed(3) + ' ' + command.x.toFixed(3) + ' ' + command.y.toFixed(3);
            } else if (command.type === 'Z') {
                d += 'Z ';
            }
        });
        this._fontPath = parse(d).path;
    }

    updateBoundingBox() {
        const { LT, RB, LB, RT } = this._boundingbox;
        const [a, b, c, d] = this._contentBox;
        vec2.transformMat3(LT, [a, b], this._currentMat)
        vec2.transformMat3(RB, [c, d], this._currentMat);
        vec2.transformMat3(LB, [a, d], this._currentMat);
        vec2.transformMat3(RT, [c, b], this._currentMat);
        const indexRBush = this.jcanvas.indexRBush;
        indexRBush.refresh(this);
    }

    markFontDirty() {
         if(this.jcanvas) {
            this._geodirty = true;
            this.addDirtyWork(this._bindFlushFontPath)
            this.addDirtyWork(this.jcanvas._bindMeshAndRender);
        }
    }

    getMeshConfig() {
        const { 
            _zIndex, _colors, _currentMat
        } = this;
        return {
            path: this._fontPath,
            _strokeWidth: 1,
            _strokeLineDash: [],
            _zIndex, 
            _colors, 
            mat: paddingMat3(_currentMat)
        }
    }
    checkHit(mouseVec) {
        return true;
    }

    static attachPainter(painter) {
        return [
            {
                ctor: Text,
                painter: 'MeshPainter',
                configGetter: 'getMeshConfig'
            },
            // {
            //     ctor: Text,
            //     // condition: (instance) => instance._strokeWidth > 0 && instance._stroke.opacity !== 0 ,
            //     painter: 'PolylinePainter',
            //     configGetter: 'getMeshConfig'
            // }
        ]
    }
}

export default Text;