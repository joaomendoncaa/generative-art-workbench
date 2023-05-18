import { Base64 } from "js-base64";

const rules = {
    frameIdentifier: "trait#",
};

let store: Art = {
    order: [],
    layers: {},
    selected: {},
};

/**
 *    ______           _                                    _           _
 *   |  ____|         | |                                  (_)         | |
 *   | |__     _ __   | |_   _ __   _   _   _ __     ___    _   _ __   | |_
 *   |  __|   | '_ \  | __| | '__| | | | | | '_ \   / _ \  | | | '_ \  | __|
 *   | |____  | | | | | |_  | |    | |_| | | |_) | | (_) | | | | | | | | |_
 *   |______| |_| |_|  \__| |_|     \__, | | .__/   \___/  |_| |_| |_|  \__|
 *                                   __/ | | |
 *                                  |___/  |_|
 **/

/**
 * Asynchronous function that initializes the plugin’s UI and sets up event listeners.
 *
 * @async
 * @function main
 * @return {Promise<void>} Returns nothing.
 */
async function main(): Promise<void> {
    if (!figma.editorType || figma.editorType !== "figma") {
        exitFigma("This plugin is only available in Figma Design Files, not Figjam!");
    }

    figma.showUI(__html__, {
        width: 500,
        height: 800,
        title: "Generative Art Workbench",
        themeColors: true,
    });

    let hasTraits = await rigStore();

    if (!hasTraits) {
        figma.ui.postMessage({
            type: "ui-update",
            selector: "body",
            html: `
             This design file doesn't have any traits.        
            `,
        });

        return;
    }

    figma.ui.onmessage = handleUIMessage;
    figma.on("selectionchange", handleSelectionChange);
}

main().catch((err) => {
    exitFigma(err);
});

/**
 *    _    _          _
 *   | |  | |        | |
 *   | |__| |   ___  | |  _ __     ___   _ __   ___
 *   |  __  |  / _ \ | | | '_ \   / _ \ | '__| / __|
 *   | |  | | |  __/ | | | |_) | |  __/ | |    \__ \
 *   |_|  |_|  \___| |_| | .__/   \___| |_|    |___/
 *                       | |
 *                       |_|
 **/

/**
 * Handles UI messages by performing different actions based on the message type.
 *
 * @param {Message} message - The message object containing the type and data.
 * @return {Promise<void>} - Returns nothing.
 */
async function handleUIMessage(message: Message): Promise<void> {
    switch (message.type) {
        case "close":
            exitFigma();

            break;
        case "view-frame":
            if (!message.id) {
                console.error("No id inside the message");
                return;
            }

            const node = figma.getNodeById(message.id);
            if (node) figma.viewport.scrollAndZoomIntoView([node]);

            break;
        case "update-order":
            if (!message.order) {
                console.error("No order inside the message");
                return;
            }

            store.order = message.order;

            renderSelectedFrames();

            break;
        case "randomize":
            randomizeTraits();

            break;
        case "clear-canvas":
            clearCanvas();

            break;
        default:
            console.error(`handleUIMessage() can't handle "${message.type}" type messages`);

            break;
    }
}

function randomizeTraits(): void {
    for (let layer of store.order) {
        store.selected[layer] = Object.values(store.layers[layer])[
            Math.floor(Math.random() * Object.values(store.layers[layer]).length)
        ];
    }

    renderSelectedFrames();
}

/**
 * Handles the change of the current selection by filtering the selected frames
 * with a specific identifier and stores the selected frames' ids based on their trait type.
 *
 * @return {void} This function does not return anything.
 */
function handleSelectionChange(): void {
    const selectedFrames = figma.currentPage.selection.filter(
        (layer) => layer.type === "FRAME" && layer.name.startsWith(rules.frameIdentifier)
    );

    if (!selectedFrames || selectedFrames.length === 0) store.selected = {};

    for (let frame of selectedFrames) {
        const { name, id } = frame as FrameNode;
        let traitType = name.split("#")[1];

        store.selected[traitType] = id;
    }

    renderSelectedFrames();
}

function clearCanvas() {
    store.selected = {};

    figma.ui.postMessage({
        type: "ui-update",
        selector: ".display-wrapper",
        html: "",
    });

    for (let layer of store.order) {
        figma.ui.postMessage({
            type: "ui-update",
            selector: `.layer[data-layer=${layer}] > .layer-controls`,
            html: /*HTML*/ `
                <button class="up" onclick="updateLayerPosition('up', '${layer}')"><span>></span></button>
                <button class="down" onclick="updateLayerPosition('down', '${layer}')"><span>></span></button>
            `,
        });

        figma.ui.postMessage({
            type: "ui-update",
            selector: `.layer[data-layer=${layer}] > span > bold`,
            html: "None",
        });
    }
}

/**
 * Deselects any repeated trait types from the current selection on the Figma page.
 *
 * TODO: Doesn't property work, deselections seems to be asynchronous and bugs may occur in the case of selecting and deselecting fast
 *
 * @return {void} This function does not return anything.
 */
function deselectRepeatedTraitTypes(): void {
    const newSelection: FrameNode[] = [];

    for (let traitType of store.order) {
        let node = figma.getNodeById(store.selected[traitType]) as FrameNode;

        if (store.selected[traitType] && node) newSelection.push(node);
    }

    figma.currentPage.selection = newSelection;
}

/**
 * Async function that filters and processes the frames of the current page, updating the store.order array and posting a message to the figma.ui.
 *
 * @return {Promise<boolean>} A Promise that resolves to true when the function completes successfully.
 */
async function rigStore(): Promise<boolean> {
    const frames = figma.currentPage.children.filter(
        (node) => node.type === "FRAME" && node.name.startsWith(rules.frameIdentifier)
    );

    if (!frames || frames.length === 0) return false;

    for (let i = 0; i < frames.length; i++) {
        let { name, id } = frames[i] as FrameNode;
        let traitType: string = name.split("#")[1];
        let traitName: string = name.split("#")[2];
        let traitID: string = id;

        if (!store.layers[traitType]) store.layers[traitType] = {};

        store.layers[traitType][traitName] = traitID;

        if (store.order.indexOf(traitType) === -1) store.order.push(traitType);
    }

    renderLayers();

    return true;
}

function renderLayers(): void {
    figma.ui.postMessage({
        type: "ui-update",
        selector: ".layers",
        html: store.order
            .map(
                (layer) => /*HTML*/ `
                    <div data-layer="${layer}" class="layer">
                        <span>
                            ${layer}
                            <bold>${store.selected[layer] ?? "None"}</bold>
                        </span>
                        <div class="layer-controls">
                            <section data-layer="${layer}"></section>
                            <button class="up" onclick="updateLayerPosition('up', '${layer}')"><span>></span></button>
                            <button class="down" onclick="updateLayerPosition('down', '${layer}')"><span>></span></button>
                        </div>
                    </div>
                `
            )
            .join(""),
    });
}

/**
 * Logs an exit message to the console and sends a notification to Figma before
 * closing the plugin. If a message is provided, it will be appended to the exit message.
 *
 * @param {string} message - (optional) message to append to the exit message.
 * @return {void} This function does not return anything.
 */
function exitFigma(message?: string): void {
    const exitMessage = "👋 Exiting workbench";

    console.warn(`${exitMessage}\n${message ? `(${message})` : ""}`);
    figma.notify(`${exitMessage}\n${message ? `(${message})` : ""}`);
    figma.closePlugin();
}

async function renderSelectedFrames(): Promise<void> {
    if (!store.order) return console.error("No order or layers available");
    if (!store.selected) return console.error("No selected layers yet");

    let html: string = "";

    for (let layer of store.order) {
        if (!store.selected[layer]) continue;

        try {
            let svg = await getImageFromFrameID(store.selected[layer]);

            if (svg) html = svg + html;
        } catch (err) {
            console.error(err);
            throw new Error((err as string).toString() ?? "Error trying to getFrameImage()");
        }
    }

    figma.ui.postMessage({
        type: "ui-update",
        selector: ".display-wrapper",
        html,
    });

    Object.entries(store.selected).forEach(([key, value]) => {
        figma.ui.postMessage({
            type: "ui-update",
            selector: ".layers > .layer[data-layer='" + key + "'] > span > bold",
            html: figma.getNodeById(value)?.name.split("#")[2] ?? "None",
        });
    });

    Object.entries(store.selected).forEach(([key, value]) => {
        figma.ui.postMessage({
            type: "ui-update",
            selector: ".layer-controls > section[data-layer='" + key + "']",
            html: /*HTML*/ `
            <button class="view" data-layer="${key}" onclick="viewFrame('${store.selected[key]}')">view frame</button>
            `,
        });
    });
}

async function getImageFromFrameID(nodeId: string): Promise<string | void> {
    const node = figma.getNodeById(nodeId) as FrameNode;

    if (!node) return console.error("Node is null");

    const imageBytes = await node.exportAsync({
        contentsOnly: true,
        format: "SVG",
    });

    const svg = String.fromCharCode(...imageBytes);

    const svgWithAttrs = svg.replace(
        /<svg/,
        `<svg shape-rendering="crispEdges" preserveAspectRatio="xMidYMid meet"`
    );

    return `${svgWithAttrs}`;
}
