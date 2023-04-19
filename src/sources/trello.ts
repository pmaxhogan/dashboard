import {config} from "dotenv";
import {Source, StatSource} from "../StatSource";
// import fetch from "node-fetch";
config();

type TrelloStats = {
    num_cards_by_list: {
        [key: string]: number;
    },
    num_cards_by_label: {
        [key: string]: number;
    },
    total_time_in_list: {
        [key: string]: number;
    },
    total_time_in_label: {
        [key: string]: number;
    }
}

interface Label {
    id: string;
    idBoard: string;
    name: string;
    color: string;
}

interface CustomFieldItem {
    id: string;
    idValue: string;
    idCustomField: string;
    idModel: string;
    modelType: string;
}

interface TrelloCard {
    id: string;
    labels: Label[];
    customFieldItems: CustomFieldItem[];
}

type CustomFieldOptions = {
    _id: string;
    idCustomField: string;
    value: {
        text: string;
    };
    color: string;
    pos: number;
};


const key = process.env.TRELLO_KEY as string;
const token = process.env.TRELLO_TOKEN as string;

const progressLists = process.env.TRELLO_PROGRESS_LISTS?.split(",") as string[];
const fieldId = process.env.TRELLO_FIELD_ID as string;


/**
 * Get all the trello cards in a list
 * @param {string} listId
 */
async function getCardsInList(listId: string,) {
    const url = `https://api.trello.com/1/lists/${listId}/cards?key=${key}&token=${token}&customFieldItems=true&fields=labels,customFieldItems`;
    const response = await fetch(url);
    return await response.json() as TrelloCard[];
}

/**
 * Get all the custom field options for a given field
 * @param {string} fieldId
 * @return {Promise<CustomFieldOptions[]>} The options
 */
async function getValuesForField(fieldId: string) {
    const url = `https://api.trello.com/1/customFields/${fieldId}/options?key=${key}&token=${token}`;
    const response = await fetch(url);
    return await response.json() as CustomFieldOptions[];
}

/**
 * Get the name of a list given its id
 * @param {string} listId
 * @return {string} The name of the list
 */
async function getNameOfList(listId: string) {
    const url = `https://api.trello.com/1/lists/${listId}?key=${key}&token=${token}&fields=name`;
    const response = await fetch(url);
    const list = await response.json();
    return list.name as string;
}

export default new StatSource(1000 * 60 * 5, Source.TRELLO,
    async () => {
        const listIdToName = new Map<string, string>();
        for (const list of progressLists) {
            listIdToName.set(list, await getNameOfList(list));
        }

        const fieldIdToTimeMinutes = new Map<string, number>();
        const values = await getValuesForField(fieldId);
        for (const value of values) {
            const split = value.value.text.split(" - ");
            const last = split[split.length - 1];
            const isMin = last.includes("min");
            const isMax = last.includes("+");
            const time = parseInt(split[split.length - 1].replace(/[^0-9]/g, "")) * (isMin ? 1 : 60) * (isMax ? 1.5 : 1);
            fieldIdToTimeMinutes.set(value._id, time);
        }

        const listToCards = new Map<string, TrelloCard[]>();
        const proms = [];
        for (const list of progressLists) {
            proms.push(getCardsInList(list).then((cards) => listToCards.set(list, cards)));
        }
        await Promise.all(proms);


        const numCardsByList = {} as { [key: string]: number };
        for (const [listId, cards] of listToCards) {
            numCardsByList[listIdToName.get(listId) as string] = cards.length;
        }

        const numCardsByLabel = {} as { [key: string]: number };
        const totalTimeInList = {} as { [key: string]: number };
        const totalTimeInLabel = {} as { [key: string]: number };

        for (const [listId, cards] of listToCards) {
            for (const card of cards) {
                for (const label of card.labels) {
                    if (!numCardsByLabel[label.name]) {
                        numCardsByLabel[label.name] = 0;
                    }
                    numCardsByLabel[label.name]++;
                }

                for (const item of card.customFieldItems) {
                    if (item.idCustomField !== fieldId) {
                        continue;
                    }

                    const time = fieldIdToTimeMinutes.get(item.idValue);
                    if (!time) {
                        continue;
                    }

                    if (!totalTimeInList[listIdToName.get(listId) as string]) {
                        totalTimeInList[listIdToName.get(listId) as string] = 0;
                    }
                    totalTimeInList[listIdToName.get(listId) as string] += time;

                    for (const label of card.labels) {
                        if (!totalTimeInLabel[label.name]) {
                            totalTimeInLabel[label.name] = 0;
                        }
                        totalTimeInLabel[label.name] += time;
                    }
                }
            }
        }

        const stats = {
            num_cards_by_list: numCardsByList,
            num_cards_by_label: numCardsByLabel,
            total_time_in_list: totalTimeInList,
            total_time_in_label: totalTimeInLabel
        } as TrelloStats;

        return {
            stats
        };
    },
    async (req, res) => {
        res.send("ok");
    },
    async (req, res) => {
        res.send("ok");
    }
);
