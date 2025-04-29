export type TypingEventType = CustomEvent<{
    count: number;
}> & { type: "typing" }