<template>
    <div class="layerpanel" ref="rootel">
        <div class="header">
            <div>Layers ({{ list.length }}) </div>
            <sub>右键可导出局部图片</sub>
        </div>
        <RecycleScroller
            ref="scroller"
            class="scroller"
            :items="list"
            :item-size="32"
            key-field="id"
        >
          <template #default="props">
            <div class="layeritem" :active="isActive(props.item)" 
                @click="selectTarget(props.item)" 
                @contextmenu="openMenu($event, props.item)">
                <div class="layeroffset" :style="`width:${props.item.depth*10}px`"></div>
                {{ props.item.name }}
                <div class="operators">
                    <img @click="toggleVisible($event, props.item)" class="visibelOp" :src="props.item.visible ? eyeFillImg : eyeCloseImg" />
                </div>
            </div>
          </template>
        </RecycleScroller>
        <div ref="menuel" class="layermenu" :style="layermenuStyle">
            <div class="layeritem" @click="exportImage">导出图片png</div>
        </div>
    </div>
</template>
<script setup>
import { ref, toRaw, onMounted } from 'vue';
import { setupListInterface, ListInterface } from './interface';
import eyeFill from './eye-fill.png';
import eyeCloseFill from './eye-slash-fill.png';

const rootel = ref(null);
const menuel = ref(null);
const list = ref([]);
const activeItem = ref(null);
const scroller = ref(null);
const currentItem = ref(null);
const layermenuStyle = ref('');
const eyeFillImg = ref(eyeFill);
const eyeCloseImg = ref(eyeCloseFill);

function updateList(newList) {
    list.value = newList;
}

function updateActiveItems(activeItemid) {
    activeItem.value = activeItemid;
    const idx = toRaw(list.value).findIndex(i => i.id === activeItemid);
    const state = scroller.value.getScroll();
    const nextScrollTop = idx * 32;
    if(state.start > nextScrollTop || state.end < nextScrollTop) {
        scroller.value.scrollToItem(idx);
    }
    
}

setupListInterface({
    update: updateList,
    activate: updateActiveItems,
});

function isActive(item) {
   return activeItem.value === item.id;
}

function selectTarget(item) {
    ListInterface.select(item.shape)
}

function exportImage() {
    const item = currentItem.value;
    if(item) {
        ListInterface.exportImage(toRaw(item.shape))
    }
    currentItem.value = null;
    layermenuStyle.value = '';
}

function openMenu(e, item) {
    e.preventDefault();
    currentItem.value = item;
    const box = rootel.value.getBoundingClientRect();

    layermenuStyle.value = `display: block;left:${e.clientX - box.left}px;top:${e.clientY - box.top}px;`;
    document.body.addEventListener('pointerdown', function(e) {
        if(menuel.value.contains(e.target)){
            return;
        }
        currentItem.value = null;
        layermenuStyle.value = '';
    }, { once: true, capture: true })
}

function toggleVisible(e, item) {
    e.stopPropagation();
    ListInterface.toggleVisible(toRaw(item.shape))

}



</script>
<style>
.layerpanel {
    display: flex;
    flex-direction: column;    
    width: 100%;
    height: 100%;
    border: 1px solid rgba(0, 0, 0, 0.1);
}
.layerpanel .header {
    height: 2.6em;
}
.layerpanel .scroller {
    width: 100%;
    flex: 1;
}
.layeritem{
    position: relative;
    height: 32px;
    align-items: center;
    justify-content: flex-start;
    display: flex;
    flex-direction: row;
    cursor: pointer;
}
.layeritem {
    border-top: 1px solid rgba(0, 0, 0, 0.1);
}
.layeritem:hover {
    background-color: rgba(0, 0, 0, 0.1);
}
.layeritem .operators {
    display: none;
}
.layeritem:hover .operators {
    display: block;
    position: absolute;
    right: 0;
}
.operators .visibelOp{
    width: 1.2em;
    position: relative;
    right: 2px;
    top: 2px;
}
.layeritem[active=true] {
    background-color: rgba(25, 37, 166, 0.21)
}
.layeroffset {
    display: block;
    height: 100%;
}
.layermenu{
    display: none;
    position: absolute;
    background-color: #fff;
    padding: 4px;
}
</style>