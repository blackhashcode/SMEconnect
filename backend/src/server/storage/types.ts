export type FileVisibility = "public" | "private";

export interface SaveFileInput {
  data: Buffer;
  contentType: string;
  visibility: FileVisibility;
}

export interface StoredFile {
  id: string;
  visibility: FileVisibility;
  contentType: string;
  size: number;
  /** Relative URL served by this API; private files are never under public/. */
  url: string;
}

export interface StoredFileContent {
  data: Buffer;
  contentType: string;
}

export interface StorageProvider {
  save(input: SaveFileInput): Promise<StoredFile>;
  read(visibility: FileVisibility, id: string): Promise<StoredFileContent | null>;
}
