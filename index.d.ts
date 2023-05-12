declare interface Message {
    type: string;
}

declare interface Art {
    order: string[];
    layers: {
        [key: string]: Set<{ name: string; id: string }>;
    };
    selected: {
        [key: string]: string;
    };
}
