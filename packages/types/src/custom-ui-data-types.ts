// Custom UI data types for the data stream
// These types define the data parts that can be sent through the stream

export interface CustomUIDataTypes {
	// For appending messages during stream restoration
	appendMessage: string;
	// Index signature to satisfy UIDataTypes constraint
	[key: string]: unknown;
}
