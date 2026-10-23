export const createClient = () => ({
  storage: {
    from: () => ({
      uploadToSignedUrl: async (path: string, token: string, file: File) => {
        const w = window as unknown as {
          storageUploads: unknown[];
          storageError: boolean;
        };
        w.storageUploads.push({ path, token, size: file.size });
        return { error: w.storageError ? { message: "Offline" } : null };
      },
    }),
  },
});
