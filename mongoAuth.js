import { initAuthCreds, BufferJSON, proto } from '@whiskeysockets/baileys';

export const useMongoDBAuthState = async (collection) => {
    const writeData = async (data, id) => {
        try {
            // Convert to string and back to plain object using BufferJSON to handle buffers
            const str = JSON.stringify(data, BufferJSON.replacer);
            const informationToStore = JSON.parse(str);
            await collection.updateOne(
                { _id: id },
                { $set: { data: informationToStore } },
                { upsert: true }
            );
        } catch (error) {
            console.error(`Error writing auth data for ${id}:`, error.message);
        }
    };

    const readData = async (id) => {
        try {
            const doc = await collection.findOne({ _id: id });
            if (doc && doc.data) {
                const str = JSON.stringify(doc.data);
                return JSON.parse(str, BufferJSON.reviver);
            }
            return null;
        } catch (error) {
            console.error(`Error reading auth data for ${id}:`, error.message);
            return null;
        }
    };

    const removeData = async (id) => {
        try {
            await collection.deleteOne({ _id: id });
        } catch (error) {
            console.error(`Error removing auth data for ${id}:`, error.message);
        }
    };

    let creds = await readData('creds');
    if (!creds) {
        creds = initAuthCreds();
        await writeData(creds, 'creds');
    }

    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data = {};
                    await Promise.all(
                        ids.map(async id => {
                            let value = await readData(`${type}-${id}`);
                            if (type === 'app-state-sync-key' && value) {
                                value = proto.Message.AppStateSyncKeyData.fromObject(value);
                            }
                            data[id] = value;
                        })
                    );
                    return data;
                },
                set: async (data) => {
                    const tasks = [];
                    for (const category in data) {
                        for (const id in data[category]) {
                            const value = data[category][id];
                            const key = `${category}-${id}`;
                            if (value) {
                                tasks.push(writeData(value, key));
                            } else {
                                tasks.push(removeData(key));
                            }
                        }
                    }
                    await Promise.all(tasks);
                }
            }
        },
        saveCreds: () => {
            return writeData(creds, 'creds');
        }
    };
};
