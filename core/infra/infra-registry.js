
class Infra {
    constructor(config) {
        this.name = config.name;
        this._setup = config.setup;
    }

    setup(context) {
        const methods = this._setup(context);
        Object.assign(this, methods);
    }
}

class InfraRegistry {
    _infras = new Map();

    regist(tool) {
        const ifr = new Infra(tool)
        this._infras.set(ifr.name, ifr);
        return ifr;
    }
    
    getTool(name) {
        return this._infras.get(name);
    }

    setup(context) {
        this._infras.forEach(infra => {
            infra.setup(context);
        });
    }



}

export default InfraRegistry;