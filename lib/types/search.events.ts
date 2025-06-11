export type SearchEventType = CustomEvent<{
    query: string;
}> & { type: "search" }