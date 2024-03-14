import {
  NetworkName,
  isDefined,
  MerkleProof,
  TXIDVersion,
} from '@railgun-community/shared-models';
import {
  nToHex,
  hexToBigInt,
  ByteLength,
  numberify,
  hexlify,
} from '@railgun-community/wallet';
import { POIMerkletreeDatabase } from '../database/databases/poi-merkletree-database';
import { poseidon } from 'circomlibjs';
import { POIMerkletreeDBItem } from '../models/database-types';
import { POIHistoricalMerklerootDatabase } from '../database/databases/poi-historical-merkleroot-database';
import debug from 'debug';

// Static value from calculation in RAILGUN Engine SDK.
const MERKLE_ZERO_VALUE: string =
  '0488f89b25bc7011eaf6a5edce71aeafb9fe706faa3c0a5cd9cbe868ae3b9ffc';

const TREE_DEPTH = 16;
const TREE_MAX_ITEMS = 65_536;

const dbg = debug('poi:poi-merkletree');

export class POIMerkletree {
  private readonly merkletreeDB: POIMerkletreeDatabase;

  private readonly merklerootDB: POIHistoricalMerklerootDatabase;

  private readonly listKey: string;

  readonly zeros: string[] = [];

  private treeLengths: number[] = [];

  private isUpdating = false;

  private readonly cachedNodeHashes: {
    [tree: number]: { [level: number]: { [index: number]: string } };
  } = {};

  constructor(
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    listKey: string,
  ) {
    this.merkletreeDB = new POIMerkletreeDatabase(networkName, txidVersion);
    this.merklerootDB = new POIHistoricalMerklerootDatabase(
      networkName,
      txidVersion,
    );
    this.listKey = listKey;
    this.calculateZeros();
  }

  private calculateZeros() {
    this.zeros[0] = MERKLE_ZERO_VALUE;
    for (let level = 1; level <= TREE_DEPTH; level += 1) {
      this.zeros[level] = POIMerkletree.hashLeftRight(
        this.zeros[level - 1],
        this.zeros[level - 1],
      );
    }
  }

  private static hashLeftRight(left: string, right: string): string {
    return nToHex(
      poseidon([hexToBigInt(left), hexToBigInt(right)]),
      ByteLength.UINT_256,
    );
  }

  getRoot(tree: number): Promise<string> {
    return this.getNodeHash(tree, TREE_DEPTH, 0);
  }

  async getLeaves(startIndex: number, endIndex: number): Promise<string[]> {
    const leaves: string[] = [];
    for (let i = startIndex; i < endIndex; i += 1) {
      leaves.push(await this.getTreeLeaf(i));
    }
    return leaves;
  }

  private async getTreeLeaf(eventIndex: number): Promise<string> {
    const { tree, index } =
      POIMerkletree.getTreeAndIndexFromEventIndex(eventIndex);
    const level = 0;
    return this.getNodeHash(tree, level, index);
  }

  async deleteNodes_DANGEROUS(tree: number): Promise<void> {
    await this.merkletreeDB.deleteAllItems_DANGEROUS();
    await this.merklerootDB.deleteAllItems_DANGEROUS();
    this.cachedNodeHashes[tree] = {};
    this.treeLengths[tree] = 0;
  }

  private async getNodeHash(
    tree: number,
    level: number,
    index: number,
  ): Promise<string> {
    if (
      isDefined(this.cachedNodeHashes[tree]) &&
      isDefined(this.cachedNodeHashes[tree][level]) &&
      this.cachedNodeHashes[tree][level][index]
    ) {
      return this.cachedNodeHashes[tree][level][index];
    }
    const hash = await this.merkletreeDB.getPOINodeHash(
      this.listKey,
      tree,
      level,
      index,
    );
    if (!isDefined(hash)) {
      return this.zeros[level];
    }
    this.cacheNodeHash(tree, level, index, hash);
    return hash;
  }

  private cacheNodeHash(
    tree: number,
    level: number,
    index: number,
    hash: string,
  ) {
    this.cachedNodeHashes[tree] ??= {};
    this.cachedNodeHashes[tree][level] ??= {};
    this.cachedNodeHashes[tree][level][index] = hash;
  }

  private createDBItem(
    tree: number,
    level: number,
    index: number,
    nodeHash: string,
  ): POIMerkletreeDBItem {
    return {
      listKey: this.listKey,
      tree,
      level,
      index,
      nodeHash,
    };
  }

  private async getTreeLengthFromDBCount(tree: number): Promise<number> {
    return this.merkletreeDB.countLeavesInTree(this.listKey, tree);
  }

  async getTreeLength(tree: number): Promise<number> {
    if (this.treeLengths[tree] != null) {
      return this.treeLengths[tree];
    }

    this.treeLengths[tree] = await this.getTreeLengthFromDBCount(tree);
    return this.treeLengths[tree];
  }

  async getTotalEventsAllTrees(): Promise<number> {
    const latestTree = await this.latestTree();
    let totalEvents = await this.getTreeLength(latestTree);
    for (let tree = 0; tree < latestTree; tree += 1) {
      totalEvents += TREE_MAX_ITEMS;
    }
    return totalEvents;
  }

  private async latestTree(): Promise<number> {
    let latestTree = 0;
    while ((await this.getTreeLength(latestTree)) > 0) latestTree += 1;
    return Math.max(0, latestTree - 1);
  }

  private async getLatestTreeAndIndex(): Promise<{
    tree: number;
    index: number;
  }> {
    const latestTree = await this.latestTree();
    const treeLength = await this.getTreeLength(latestTree);
    return { tree: latestTree, index: treeLength - 1 };
  }

  async getNextTreeAndIndex(): Promise<{
    tree: number;
    index: number;
  }> {
    const { tree: latestTree, index: latestIndex } =
      await this.getLatestTreeAndIndex();

    if (latestIndex + 1 >= TREE_MAX_ITEMS) {
      return { tree: latestTree + 1, index: 0 };
    }
    return { tree: latestTree, index: latestIndex + 1 };
  }

  static getGlobalIndex(tree: number, index: number): number {
    return tree * TREE_MAX_ITEMS + index;
  }

  static getTreeAndIndexFromEventIndex(eventIndex: number): {
    tree: number;
    index: number;
  } {
    return {
      tree: Math.floor(eventIndex / TREE_MAX_ITEMS),
      index: eventIndex % TREE_MAX_ITEMS,
    };
  }

  async insertLeaf(
    eventIndex: number,
    nodeHash: string,
    validatedMerkleroot: Optional<string>,
  ) {
    if (this.isUpdating) {
      throw new Error('POI merkletree is already updating');
    }
    this.isUpdating = true;

    const { tree: latestTree, index: latestIndex } =
      await this.getLatestTreeAndIndex();
    if (latestIndex >= 0) {
      const latestLeaf = await this.getNodeHash(latestTree, 0, latestIndex);
      if (latestLeaf === MERKLE_ZERO_VALUE) {
        this.isUpdating = false;
        throw new Error('Previous leaf is ZERO');
      }
      if (latestLeaf === nodeHash) {
        this.isUpdating = false;
        throw new Error('Previous leaf has the same node hash - invalid entry');
      }
    }

    const { tree, index } = await this.getNextTreeAndIndex();
    const nextEventCommitmentIndex = POIMerkletree.getGlobalIndex(tree, index);
    if (eventIndex !== nextEventCommitmentIndex) {
      this.isUpdating = false;
      if ((await this.getNodeHash(tree, 0, eventIndex)) === nodeHash) {
        // Event already exists in tree
        dbg('POI event already exists in tree - skipping addition');
        return;
      }
      throw new Error(
        `[Warning] Invalid eventIndex ${eventIndex} for POI merkletree insert - next expected ${nextEventCommitmentIndex}`,
      );
    }

    try {
      await this.insertLeavesInTree(
        tree,
        index,
        [nodeHash],
        validatedMerkleroot,
      );
      this.isUpdating = false;
    } catch (err) {
      this.isUpdating = false;
      throw err;
    }
  }

  async insertMultipleLeaves_TEST_ONLY(
    eventIndex: number,
    nodeHashes: string[],
  ): Promise<void> {
    if (this.isUpdating) {
      throw new Error('POI merkletree is already updating - test only');
    }
    this.isUpdating = true;

    const { tree, index } = await this.getNextTreeAndIndex();
    const nextEventCommitmentIndex = POIMerkletree.getGlobalIndex(tree, index);
    if (eventIndex !== nextEventCommitmentIndex) {
      this.isUpdating = false;
      throw new Error(
        `[Warning] Invalid eventIndex ${eventIndex} for POI merkletree insert - next expected ${nextEventCommitmentIndex}`,
      );
    }

    let nextTree = tree;
    let startIndex = index;

    let nodeHashesStartIndex = 0;

    try {
      // Insert leaves into each tree.
      // Iterate through trees once the MAX_ITEMS is reached.
      while (nodeHashes.length > nodeHashesStartIndex) {
        const remainingSpotsInTree = TREE_MAX_ITEMS - startIndex;
        const endIndex = nodeHashesStartIndex + remainingSpotsInTree;
        const nodeHashesForTree = nodeHashes.slice(
          nodeHashesStartIndex,
          endIndex,
        );

        await this.insertLeavesInTree(
          nextTree,
          startIndex,
          nodeHashesForTree,
          undefined,
        );

        nextTree += 1;
        startIndex = 0;
        nodeHashesStartIndex += nodeHashesForTree.length;
      }
      this.isUpdating = false;
    } catch (err) {
      this.isUpdating = false;
      throw err;
    }
  }

  private async insertLeavesInTree(
    tree: number,
    startIndex: number,
    nodeHashes: string[],
    validatedMerkleroot: Optional<string>,
  ): Promise<void> {
    const firstLevelHashWriteGroup: string[][] = [];
    firstLevelHashWriteGroup[0] = [];

    nodeHashes.forEach((nodeHash, nodeIndex) => {
      firstLevelHashWriteGroup[0][startIndex + nodeIndex] = nodeHash;
    });

    const endIndex = startIndex + nodeHashes.length;

    const hashWriteGroup: string[][] = await this.fillHashWriteGroup(
      firstLevelHashWriteGroup,
      tree,
      startIndex,
      endIndex,
    );

    const root = hashWriteGroup[TREE_DEPTH][0];
    if (isDefined(validatedMerkleroot) && root !== validatedMerkleroot) {
      throw new Error(
        `Invalid merkleroot: got ${root}, expected ${validatedMerkleroot}`,
      );
    }

    await this.writeToDB(tree, endIndex - 1, hashWriteGroup);

    this.treeLengths[tree] += nodeHashes.length;
  }

  async rebuildTree(tree: number): Promise<void> {
    const firstLevelHashWriteGroup: string[][] = [];

    firstLevelHashWriteGroup[0] = [];

    // Should not use cached treeLength value here because it can be stale.
    const treeLength = await this.getTreeLengthFromDBCount(tree);

    const nodeFetcher = new Array<Promise<Optional<string>>>(treeLength);

    // Fetch each leaf we need to scan
    for (let index = 0; index < treeLength; index += 1) {
      nodeFetcher[index] = this.getNodeHash(tree, 0, index);
    }
    const leaves = await Promise.all(nodeFetcher);

    // Push values to leaves of write index
    leaves.forEach((hash, index) => {
      firstLevelHashWriteGroup[0][index] = hash ?? this.zeros[0];
    });

    const startIndex = 0;
    const endIndex = treeLength - 1;

    const hashWriteGroup: string[][] = await this.fillHashWriteGroup(
      firstLevelHashWriteGroup,
      tree,
      startIndex,
      endIndex,
    );

    const items: POIMerkletreeDBItem[] = [];
    hashWriteGroup.forEach((levelItems, level) => {
      levelItems.forEach((nodeHash, index) => {
        const item: POIMerkletreeDBItem = this.createDBItem(
          tree,
          level,
          index,
          nodeHash,
        );
        items.push(item);
      });
    });

    // Delete tree in DB
    await this.merkletreeDB.deleteAllPOIMerkletreeNodesForTree(
      this.listKey,
      tree,
    );

    // Re-insert entire tree in DB
    await this.merkletreeDB.updatePOIMerkletreeNodes(items);
  }

  private async fillHashWriteGroup(
    firstLevelHashWriteGroup: string[][],
    tree: number,
    startIndex: number,
    endIndex: number,
  ): Promise<string[][]> {
    const hashWriteGroup: string[][] = firstLevelHashWriteGroup;

    let level = 0;

    let index = startIndex;
    let nextLevelStartIndex = startIndex;
    let nextLevelEndIndex = endIndex;

    // Loop through each level and calculate values
    while (level < TREE_DEPTH) {
      // Set starting index for this level
      index = nextLevelStartIndex;

      // Ensure writecache array exists for next level
      hashWriteGroup[level] = hashWriteGroup[level] ?? [];
      hashWriteGroup[level + 1] = hashWriteGroup[level + 1] ?? [];

      // Loop through every pair
      for (index; index <= nextLevelEndIndex + 1; index += 2) {
        let nodeHash: string;

        if (index % 2 === 0) {
          // Left
          nodeHash = POIMerkletree.hashLeftRight(
            hashWriteGroup[level][index] ||
              (await this.getNodeHash(tree, level, index)),
            hashWriteGroup[level][index + 1] ||
              (await this.getNodeHash(tree, level, index + 1)),
          );
        } else {
          // Right
          nodeHash = POIMerkletree.hashLeftRight(
            hashWriteGroup[level][index - 1] ||
              (await this.getNodeHash(tree, level, index - 1)),
            hashWriteGroup[level][index] ||
              (await this.getNodeHash(tree, level, index)),
          );
        }

        hashWriteGroup[level + 1][index >> 1] = nodeHash;
      }

      // Calculate starting and ending index for the next level
      nextLevelStartIndex >>= 1;
      nextLevelEndIndex >>= 1;

      // Increment level
      level += 1;
    }

    return hashWriteGroup;
  }

  private async writeToDB(
    tree: number,
    index: number,
    hashWriteGroup: string[][],
  ) {
    const items: POIMerkletreeDBItem[] = [];
    hashWriteGroup.forEach((levelItems, level) => {
      levelItems.forEach((nodeHash, index) => {
        this.cacheNodeHash(tree, level, index, nodeHash);
        const item: POIMerkletreeDBItem = this.createDBItem(
          tree,
          level,
          index,
          nodeHash,
        );
        items.push(item);
      });
    });

    await this.merkletreeDB.updatePOIMerkletreeNodes(items);

    const merkleroot = await this.getRoot(tree);
    const globalLeafIndex = POIMerkletree.getGlobalIndex(tree, index);
    await this.merklerootDB.insertMerkleroot(
      this.listKey,
      globalLeafIndex,
      merkleroot,
    );
  }

  async getMerkleProofFromNodeHash(nodeHash: string): Promise<MerkleProof> {
    const node = await this.merkletreeDB.getLeafNodeFromHash(
      this.listKey,
      nodeHash,
    );
    if (!isDefined(node)) {
      throw new Error(
        `No POI node for blinded commitment (node hash) ${nodeHash}`,
      );
    }
    return this.getMerkleProof(node.tree, node.index);
  }

  async nodeHashExists(nodeHash: string): Promise<boolean> {
    return this.merkletreeDB.nodeHashExists(this.listKey, nodeHash);
  }

  async getMerkleProof(tree: number, index: number): Promise<MerkleProof> {
    const treeLength = await this.getTreeLength(tree);
    if (index >= treeLength) {
      throw new Error(
        `Invalid index for POI merkletree proof: last index ${
          treeLength - 1
        }, requested ${index}`,
      );
    }

    // Fetch leaf
    const leaf = await this.getNodeHash(tree, 0, index);

    // Get indexes of path elements to fetch
    const elementsIndexes: number[] = [index ^ 1];

    // Loop through each level and calculate index
    while (elementsIndexes.length < TREE_DEPTH) {
      // Shift right and flip last bit
      elementsIndexes.push(
        (elementsIndexes[elementsIndexes.length - 1] >> 1) ^ 1,
      );
    }

    // Fetch path elements
    const elements = await Promise.all(
      elementsIndexes.map((elementIndex, level) =>
        this.getNodeHash(tree, level, elementIndex),
      ),
    );

    // Convert index to bytes data, the binary representation is the indices of the merkle path
    const indices = nToHex(BigInt(index), ByteLength.UINT_256);

    // Fetch root
    const root = await this.getRoot(tree);

    // Return proof
    return {
      leaf,
      elements,
      indices,
      root,
    };
  }

  static verifyProof(proof: MerkleProof): boolean {
    // Get indices as BN form
    const indices = numberify(proof.indices);

    // Calculate proof root and return if it matches the proof in the MerkleProof
    // Loop through each element and hash till we've reduced to 1 element
    const calculatedRoot = proof.elements.reduce((current, element, index) => {
      // If index is right
      if (indices.testn(index)) {
        return POIMerkletree.hashLeftRight(element, current);
      }

      // If index is left
      return POIMerkletree.hashLeftRight(current, element);
    }, proof.leaf);

    return hexlify(proof.root) === hexlify(calculatedRoot);
  }
}
