import {
  isDefined,
  NodeStatusForNetwork,
  POIListStatus,
} from '@railgun-community/shared-models';

export type ListStatus = {
  listAddress: string;
  listValues: POIListStatus[];
};

export type ListStatuses = {
  lists?: ListStatus[];
};

export type TxIdStatus = {
  currentTxidIndex: (number | undefined)[];
  validatedTxidIndex: (number | undefined)[];
  currentMerkleroot: (string | undefined)[];
  validatedMerkleroot: (string | undefined)[];
};

export type ShieldQueueStatus = {
  addedPOI: (number | undefined)[];
  allowed: (number | undefined)[];
  blocked: (number | undefined)[];
  latestShield: (string | undefined)[];
  pending: (number | undefined)[];
  unknown: (number | undefined)[];
};

// TODO: Improve serializeAllNodesData and extract code
export const serializeAllNodesData = (allNodesData: NodeStatusForNetwork[]) => {
  let txidStatus: TxIdStatus = {
    currentTxidIndex: [],
    validatedTxidIndex: [],
    currentMerkleroot: [],
    validatedMerkleroot: [],
  };
  let shieldQueueStatus: ShieldQueueStatus = {
    addedPOI: [],
    allowed: [],
    blocked: [],
    latestShield: [],
    pending: [],
    unknown: [],
  };
  let listStatuses: ListStatuses = {};

  allNodesData.forEach((node, nodeIndex) => {
    const isFirstNode = nodeIndex === 0;

    // TxIdStatus:
    const currentTxidIndex = node.txidStatus.currentTxidIndex ?? undefined;
    const currentMerkleroot = node.txidStatus.currentMerkleroot ?? undefined;
    const validatedMerkleroot =
      node.txidStatus.validatedMerkleroot ?? undefined;
    const validatedTxidIndex = node.txidStatus.validatedTxidIndex ?? undefined;

    if (isFirstNode) {
      txidStatus = {
        currentTxidIndex: [currentTxidIndex],
        currentMerkleroot: [currentMerkleroot],
        validatedMerkleroot: [validatedMerkleroot],
        validatedTxidIndex: [validatedTxidIndex],
      };
    } else {
      txidStatus.currentMerkleroot.push(currentMerkleroot);
      txidStatus.currentTxidIndex.push(currentTxidIndex);
      txidStatus.validatedTxidIndex.push(validatedTxidIndex);
      txidStatus.validatedMerkleroot.push(validatedMerkleroot);
    }

    // ShieldQueueStatus
    const addedPOI = node.shieldQueueStatus.addedPOI ?? undefined;
    const allowed = node.shieldQueueStatus.allowed ?? undefined;
    const blocked = node.shieldQueueStatus.blocked ?? undefined;
    const latestShield = node.shieldQueueStatus.latestShield ?? undefined;
    const pending = node.shieldQueueStatus.pending ?? undefined;
    const unknown = node.shieldQueueStatus.unknown ?? undefined;

    if (isFirstNode) {
      shieldQueueStatus = {
        addedPOI: [addedPOI],
        allowed: [allowed],
        blocked: [blocked],
        latestShield: [latestShield],
        pending: [pending],
        unknown: [unknown],
      };
    } else {
      shieldQueueStatus.addedPOI.push(addedPOI);
      shieldQueueStatus.allowed.push(allowed);
      shieldQueueStatus.blocked.push(blocked);
      shieldQueueStatus.latestShield.push(latestShield);
      shieldQueueStatus.pending.push(pending);
      shieldQueueStatus.unknown.push(unknown);
    }

    // ListStatuses
    const listStatusesArray = Object.entries(node.listStatuses);
    listStatusesArray.forEach(list => {
      const [listAddress, listValues] = list;

      if (isFirstNode) {
        // setting uo the structure of the listStatuses object.
        listStatuses = {
          lists: [
            {
              listAddress,
              listValues: [listValues],
            },
          ],
        };
      } else if (
        isDefined(listStatuses?.lists) &&
        listStatuses.lists.length > 0
      ) {
        // add data to existing list
        const indexOfList = listStatuses?.lists.findIndex(
          listedList => listedList.listAddress === listAddress,
        );

        if (
          isDefined(indexOfList) &&
          indexOfList >= 0 &&
          listStatuses.lists[indexOfList].listValues.length > 0
        ) {
          listStatuses.lists[indexOfList].listValues.push(listValues);
        } else {
          // Add new list
          listStatuses.lists?.push({
            listAddress,
            listValues: [listValues],
          });
        }
      }
    });
  });

  const allNodesDataSerialized = {
    txidStatus,
    shieldQueueStatus,
    listStatuses,
  };

  return Object.entries(allNodesDataSerialized);
};
