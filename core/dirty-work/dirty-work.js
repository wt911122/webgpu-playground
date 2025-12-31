const queue = [];

export const addClearSourceWork = (jflow, source) => {
    clearQueue.push([jflow, source]);
}

export const addDirtyWork = (work) => {
    if(queue.includes(work)) {
        const idx = queue.findIndex(w => w === work);
        queue.splice(idx, 1);
        queue.push(work);
    } else {
        queue.push(work);
    }
    flush();
}
let inFlush = false;
const flush = () => {
    if(inFlush) {
        return;
    }
    inFlush = true;
    Promise.resolve().then(() => {
        while(queue.length) {
            const fn = queue.shift();
            try {
                fn();
            } catch(err) { console.error(err) }
        }
        inFlush = false
    });
}