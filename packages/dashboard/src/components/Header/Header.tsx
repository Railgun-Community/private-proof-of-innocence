import { useState } from 'react';
import { Selector } from '@components/Selector/Selector';
import { Text } from '@components/Text/Text';
import { AvailableNodes, availableNodesArray } from '@constants/nodes';
import { useDrawerStore, useNodeStore } from '@state/stores';
import { IconType, renderIcon } from '@utils/icon-service';
import styles from './Header.module.scss';
import colors from '@scss/colors.module.scss';

type NodeOption = {
  value: AvailableNodes;
  label: string;
};

const getNodeLabel = (nodeIp: AvailableNodes) => {
  if (nodeIp === AvailableNodes.Aggregator) return 'aggregator-node';
  if (nodeIp === AvailableNodes.Blank) return 'blank-node';
  if (nodeIp === AvailableNodes.OFAC) return 'ofac-node';
  else return 'unknown';
};

export const Header = () => {
  const { toggleDrawer } = useDrawerStore();
  const { nodeIp, setNodeIp } = useNodeStore();

  const defaultNodeOption = {
    label: getNodeLabel(nodeIp),
    value: nodeIp,
  };
  const [currentNodeOption, setCurrentNodeOption] =
    useState<NodeOption>(defaultNodeOption);

  const onSelectNode = (option: NodeOption) => {
    setCurrentNodeOption(option);
    setNodeIp(option.value);
  };

  const nodeOptions: NodeOption[] = availableNodesArray.map(nodeIp => ({
    label: getNodeLabel(nodeIp),
    value: nodeIp,
  }));

  return (
    <div className={styles.headerContainer}>
      <div className={styles.hamburgerMenu} onClick={toggleDrawer}>
        {renderIcon(IconType.HamburgerMenu, undefined, colors.black)}
        <Text className={styles.projectTitle}>POI Dashboard</Text>
      </div>
      <Selector
        options={nodeOptions}
        value={currentNodeOption}
        placeholder={`Node IP: ${nodeIp}`}
        onValueChange={option => onSelectNode(option as NodeOption)}
      />
    </div>
  );
};
