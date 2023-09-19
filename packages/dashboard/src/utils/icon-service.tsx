import { ReactElement } from 'react';
import {
  MdCheck as CheckIcon,
  MdContentCopy as CopyIcon,
  MdRefresh as Refresh,
} from 'react-icons/md';
import { RxHamburgerMenu as HamburgerMenu } from 'react-icons/rx';

export enum IconType {
  Check = 'Check',
  Copy = 'Copy',
  Refresh = 'Refresh',
  HamburgerMenu = 'HamburgerMenu',
}

export const renderIcon = (
  iconTypeOrSrc: IconType | string,
  size: number = 20,
  color: string = '#FAFAFA', //TODO: change for styleguide
): ReactElement => {
  const props = { size, color };

  switch (iconTypeOrSrc) {
    case IconType.Check:
      return <CheckIcon {...props} />;
    case IconType.Refresh:
      return <Refresh {...props} />;
    case IconType.Copy:
      return <CopyIcon {...props} />;
    case IconType.HamburgerMenu:
      return <HamburgerMenu {...props} />;
    default:
      return (
        <img
          src={iconTypeOrSrc}
          alt="icon"
          height={size}
          width={size}
          onError={({ currentTarget }) => {
            currentTarget.onerror = null; // Prevents looping
            // currentTarget.src = ImageSwirl();
          }}
        />
      );
  }
};
