import { createApp } from 'vue'

import VirtualScroller from 'vue-virtual-scroller'
import Layer from './layer.vue'

import 'vue-virtual-scroller/dist/vue-virtual-scroller.css'

const app = createApp(Layer)
app.use(VirtualScroller)
app.mount('#layer')