import { Avatar } from '@/characters/Avatar'
import { useKeeperAvatar } from './keeper'

/** The keeper's round head (account menu, Réglages). */
export function KeeperAvatar({ className }: { className?: string }) {
  const { name, photo, url } = useKeeperAvatar()
  return <Avatar name={name} photo={photo} url={url} className={className} />
}
