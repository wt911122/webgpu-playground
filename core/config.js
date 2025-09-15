class InstanceConfig {
    _instance = null;
    _getConfigFnName = '';
    _config = {};
    _painterConfig = new Map();
    _bufferMap = new Map();
    _bindingGroup = new Map();

    _condition = undefined;
    _enable = true;

    _indexShift = 0;

    get enable() {
        return this._enable;
    }

    constructor(instance, configMeta) {
        this._instance = instance;
        this._condition = configMeta.condition;
        this._getConfigFnName = configMeta.fnName;
        this._indexShift = configMeta.idx / configMeta.total;
        this.updateConfig();
    }

    _checkState() {
        if(this._condition) {
            this._enable = this._condition(this._instance);
        }
        return this._enable;
    }

    updateConfig() {
        this._checkState();
        if(this._enable) {
            Object.assign(this._config,  this._instance[this._getConfigFnName]());
        }
    }

    getConfig() {
        return this._config;
    }

    setPainterConfig(key, value) {
        this._painterConfig.set(key, value);
    }
    getPainterConfig(key) {
        return this._painterConfig.get(key);
    }

    addBuffer(name, buffer){
        this._bufferMap.set(name, buffer);
    }
    getBuffer(name) {
        return this._bufferMap.get(name);
    }

    addBindGroup(name, bg) {
        this._bindingGroup.set(name, bg);
    }
    getBindGroup(name) {
        return this._bindingGroup.get(name);
    }

}

export default InstanceConfig;