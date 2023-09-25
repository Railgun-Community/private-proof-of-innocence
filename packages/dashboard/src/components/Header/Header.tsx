import { useState } from 'react';
import { Selector } from '@components/Selector/Selector';
import { Text } from '@components/Text/Text';
import { useDrawerStore, useNodeStore } from '@state/stores';
import { IconType, renderIcon } from '@utils/icon-service';
import styles from './Header.module.scss';

type NodeOption = {
  value: string; // TODO: Change for the correct value
  label: string;
};

export const Header = () => {
  const { toggleDrawer } = useDrawerStore();
  const { nodeIp } = useNodeStore();

  const defaultNodeOption = {
    label: `Node IP: ${nodeIp}`,
    value: nodeIp ?? 'localhost',
  };
  const [currentNodeOption, setCurrentNodeOption] =
    useState<NodeOption>(defaultNodeOption);

  const onSelectNode = (option: NodeOption) => {
    setCurrentNodeOption(option);
  };

  const nodeOptions: NodeOption[] = [
    defaultNodeOption,
    {
      label: 'Node fake1',
      value: nodeIp ?? 'localhost',
    },
    {
      label: 'Node fake2',
      value: nodeIp ?? 'localhost',
    },
  ];

  return (
    <div className={styles.headerContainer}>
      <div className={styles.hamburgerMenu} onClick={toggleDrawer}>
        {renderIcon(IconType.HamburgerMenu)}
        <Text>POI Dashboard</Text>
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
