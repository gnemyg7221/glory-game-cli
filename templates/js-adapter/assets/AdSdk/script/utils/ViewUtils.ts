import { Widget } from "cc";
import { Layers } from "cc";
import { Node } from "cc";
import { director } from "cc";


export class ViewUtils {
    /**
    * 创建一个节点，挂到当前场景 Canvas 最上层，并用 Widget 铺满全屏。
    * uiIndex 需高于 UIMgr 的 UIParent（index+1000），否则会被设置弹窗等盖住。
    * @returns 创建好的节点；若当前无场景则返回 null
    */
    public static createFullScreenTopNode(name = 'AdFullScreenRoot'): Node {
        const scene = director.getScene();
        if (!scene) {
            console.warn('[AdDataQueryDispose] 当前无场景，无法创建全屏节点');
            return null;
        }
        const parent = scene.getChildByName('Canvas') || scene;
        const node = new Node(name);
        // UIMgr 的 TOP 层是 index+1000；广告全屏层必须更高，否则二次打开隐私会被盖住
        (node as any).uiIndex = 9000;
        node.layer = parent.layer || Layers.Enum.UI_2D;
        node.setParent(parent);
        node.setSiblingIndex(parent.children.length - 1);

        const widget = node.addComponent(Widget);
        widget.isAlignTop = true;
        widget.isAlignBottom = true;
        widget.isAlignLeft = true;
        widget.isAlignRight = true;
        widget.top = 0;
        widget.bottom = 0;
        widget.left = 0;
        widget.right = 0;
        widget.alignMode = Widget.AlignMode.ON_WINDOW_RESIZE;
        widget.updateAlignment();

        return node;
    }

    /** SDK prefabs are authored on the default layer. This game's UI camera only draws UI_2D. */
    public static setLayer(node: Node, layer = Layers.Enum.UI_2D) {
        node.layer = layer;
        for (const child of node.children) {
            this.setLayer(child, layer);
        }
    }

    /** 把节点及其父节点提到 Canvas 最前，避免被业务 UI 遮挡 */
    public static bringToCanvasFront(node: Node | null | undefined) {
        if (!node?.isValid) {
            return;
        }
        const root = node.parent?.isValid ? node.parent : node;
        const canvas = root.parent;
        if (!canvas?.isValid) {
            return;
        }
        if ((root as any).uiIndex == null || (root as any).uiIndex < 9000) {
            (root as any).uiIndex = 9000;
        }
        root.setSiblingIndex(canvas.children.length - 1);
        if (node !== root) {
            node.setSiblingIndex(root.children.length - 1);
        }
    }
}