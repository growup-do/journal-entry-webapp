// 画面の中から別の画面へ移る（onNavigate を受け取らない部品向け。App が 'proto-navigate' を受けてメニュー選択と同じ処理をする）
export const goScreen = (key: string) => window.dispatchEvent(new CustomEvent<string>('proto-navigate', { detail: key }));
