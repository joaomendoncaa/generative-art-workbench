import { Base64 } from "js-base64";
import icons from "./icons";

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
            html: /*HTML*/ `
                <p class="missing-traits">
                    This design file doesn't have any frames with traits. Remember to follow the <span>trait#&lt;trait type&gt;#&lt;trait name&gt;</span> naming convention for each trait to be recognized by this plugin.
                </p>
            `,
        });

        return;
    }

    figma.ui.onmessage = handleUIMessage;
    figma.on("selectionchange", handleSelectionChange);

    displaySavedOrders();
    loadFirstOrder();
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

            store.order = message.order as string[];

            renderLayers();
            renderSelectedFrames();

            break;
        case "randomize":
            randomizeTraits();

            break;
        case "clear-canvas":
            clearCanvas();

            break;
        case "save-order":
            saveCurrentOrder();

            break;
        case "delete-order":
            if (!message.order) {
                console.error("No order inside the message");
                return;
            }

            deleteSavedOrder(message.order as string);

            break;
        case "replace-trait":
            if (!message.layer) {
                console.error("Missing layer to be replaced");
                return;
            }

            figma.currentPage.selection = [];

            let notification = figma.notify(
                `Next frame you select will replace ${message.layer} currently selected`
            );

            const handleSelectionChangeTemporarily = () => {
                const selectedFrame = figma.currentPage.selection[0];

                if (!selectedFrame || selectedFrame.type !== "FRAME" || !message.layer) {
                    figma.notify("No frame selected", {
                        error: true,
                        timeout: 2000,
                    });

                    return;
                }

                store.selected[message.layer] = selectedFrame.id;
                notification.cancel();

                figma.off("selectionchange", handleSelectionChangeTemporarily);
            };

            figma.on("selectionchange", handleSelectionChangeTemporarily);

            break;
        case "randomize-trait":
            if (!message.layer) {
                console.error("Missing layer to be replaced");
                return;
            }

            const newNode = figma.getNodeById(
                Object.values(store.layers[message.layer])[
                    Math.floor(Math.random() * Object.values(store.layers[message.layer]).length)
                ]
            );

            if (newNode && newNode.name.toLowerCase() !== "none") {
                store.selected[message.layer] = newNode.id;
            }

            renderLayers();
            renderSelectedFrames();

            break;
        case "delete-trait":
            if (!message.layer) {
                console.error("Missing layer to be replaced");
                return;
            }

            if (store.selected[message.layer]) delete store.selected[message.layer];

            renderLayers();
            renderSelectedFrames();

            break;
        default:
            console.error(`handleUIMessage() can't handle "${message.type}" type messages`);

            break;
    }
}

async function deleteSavedOrder(order: string): Promise<void> {
    let existingOrders = await figma.clientStorage.getAsync("orders");

    if (!existingOrders) {
        return;
    }

    existingOrders = existingOrders.filter((o: string) => o !== order);

    await figma.clientStorage.setAsync("orders", existingOrders);

    displaySavedOrders();
}

async function saveCurrentOrder(): Promise<void> {
    if (store.order.length === 0) {
        return;
    }

    const existingOrders = await figma.clientStorage.getAsync("orders");

    if (existingOrders && existingOrders.includes(store.order.join(","))) {
        figma.notify("Order is already saved locally", {
            error: true,
        });

        return;
    }

    await figma.clientStorage.setAsync("orders", [
        ...(existingOrders || []),
        store.order.join(","),
    ]);

    displaySavedOrders();
}

async function displaySavedOrders() {
    const existingOrders = await figma.clientStorage.getAsync("orders");

    if (!existingOrders) {
        return;
    }

    figma.ui.postMessage({
        type: "ui-update",
        selector: ".saved-orders",
        html: existingOrders
            .map((order: string) => {
                return /*HTML*/ `
                <div class="saved-order">
                    <span>${order.split(",").join(" > ")}</span>
                    <div class="saved-order-controls">
                        <button onClick="loadOrder('${order}')">load</button>
                        <button onClick="deleteLocalOrder('${order}')">delete</button>
                    </div>
                </div>
            `;
            })
            .join(""),
    });
}

async function loadFirstOrder(): Promise<void> {
    const existingOrders = await figma.clientStorage.getAsync("orders");

    if (!existingOrders || existingOrders.length === 0) {
        return;
    }

    figma.notify(`Loading saved order: ${existingOrders[0]}`);
    store.order = existingOrders[0].split(",");

    renderLayers();
    renderSelectedFrames();
}

function randomizeTraits(): void {
    let newSelection: Record<string, string> = {};

    for (let layer of store.order) {
        const newNode = figma.getNodeById(
            Object.values(store.layers[layer])[
                Math.floor(Math.random() * Object.values(store.layers[layer]).length)
            ]
        );

        if (newNode && newNode.name.toLowerCase() !== "none") {
            newSelection[layer] = newNode.id;
        }
    }

    store.selected = newSelection;

    renderLayers();
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

    for (let frame of selectedFrames) {
        const { name, id } = frame as FrameNode;
        let traitType = name.split("#")[1];
        let traitName = name.split("#")[2];

        if (traitName.toLowerCase() === "none") delete store.selected[traitType];
        else store.selected[traitType] = id;
    }

    renderLayers();
    renderSelectedFrames();
}

function clearCanvas() {
    store.selected = {};

    figma.ui.postMessage({
        type: "ui-update",
        selector: ".display-wrapper",
        html: "",
    });

    figma.ui.postMessage({
        type: "ui-update",
        selector: ".display-wrapper-floating",
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
                            <button onclick="replaceLayer('${layer}')">${icons.new}</button>
                            <button onclick="randomizeLayer('${layer}')">${icons.randomize}</button>
                            <button onclick="deleteLayer('${layer}')">${icons.delete}</button>
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

    let displayWrapperHTML: string = "";

    for (let layer of store.order) {
        if (!store.selected[layer]) continue;

        try {
            let svg = await getImageFromFrameID(store.selected[layer]).catch((err) =>
                console.error(err)
            );

            if (svg) displayWrapperHTML = svg + displayWrapperHTML;
        } catch (err) {
            console.error(err);
            throw new Error((err as string).toString() ?? "Error trying to getFrameImage()");
        }
    }

    figma.ui.postMessage({
        type: "ui-update",
        selector: ".display-wrapper",
        html: displayWrapperHTML,
    });

    figma.ui.postMessage({
        type: "ui-update",
        selector: ".display-wrapper-floating",
        html: displayWrapperHTML,
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
                <button class="view" data-layer="${key}" onclick="viewFrame('${store.selected[key]}')">VIEW</button>
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
