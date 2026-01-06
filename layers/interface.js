export const ListInterface = {
    // layer 方法
    update(newList) {},
    activate(target) {},

    // jcanvas方法
    select(shape) {},
    exportImage(shape) {},
    toggleVisible(shape) {}
}

export function setupListInterface(configs) {
    Object.assign(ListInterface, configs)
}
