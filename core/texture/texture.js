export class BaseTexture {
    _source = undefined;
    _bindGroup = undefined;
    _texture = undefined;
    _isDirty = true;
    width = 0;
    height = 0;
    _filters = [];

    get source() {
        return this._source;
    }

    get dirty() {
        return this._isDirty;
    }

    get bindGroup(){
        return this._bindGroup;
    }
    
    constructor(w, h, configs = {}) {
        this.width = w;
        this.height = h;
    }

    create() { }

    update(options) { }

    applyFilter(name) {
        this._filters.push(name)
    }

    paint(texturePainter) {
        this._texture = texturePainter.createTextureSource(this.source);
        this._bindGroup = texturePainter.prepareBindGroup(this._texture);
        this._isDirty = false;
    }
    
}