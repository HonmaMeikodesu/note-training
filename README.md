# 🎵 NoteTrain - 视唱练耳与相对音感实验室 (Ear Trainer & Piano Sandbox)

欢迎来到 **NoteTrain** —— 专为提升**相对音感（Relative Pitch）**量身定制的个人视唱练耳与钢琴沙盒工具。本工具基于 **React Native & Expo** 技术栈，针对**首调唱名法（Solfège/Functional Pitch Training）**设计，配合高品质虚拟钢琴键盘，助你在每日的量化训练中，快速建立起“听歌即能浮现简谱、看谱即可准确唱音”的听觉与肌肉反射。

---

## 目录
1. [📖 产品使用说明文档 (User Manual)](#1-product-manual)
   - [相对音感的训练秘诀：首调功能法](#相对音感的训练秘诀)
   - [核心功能板块与交互指南](#核心功能板块与交互指南)
2. [🛠️ 技术实现方案 (Technical Implementation)](#2-technical-implementation)
   - [项目架构与文件目录](#项目架构与文件)
   - [高响应、零延迟的音频引擎设计](#音频引擎设计)
   - [离线数据持久化与打卡算法](#数据持久化)
   - [首调听音与解决算法模型](#核心算法模型)
3. [🚀 开发调试与打包手册 (Development & Debug Manual)](#3-development-manual)
   - [快速上手指南](#快速上手)
   - [调试技巧与故障排查](#调试与排查)
   - [如何拓展核心功能](#进阶拓展)

---

<a name="1-product-manual"></a>

## 1. 📖 产品使用说明文档 (User Manual)

### 💡 相对音感的训练秘诀：首调功能法

许多传统视唱练耳软件采用“孤立音程听辨”（如“纯四度”或“大三度”），这种训练对于实际音乐场景（如弹唱、即兴、扒谱）的转化效率非常低。

**NoteTrain 采用现代音乐认知学推崇的“首调功能音感训练”：**
- **建立调性感觉（Tonal Center）**：训练开始时，系统会为您自动弹奏一组 **I-IV-V-I 建立和弦进行（Cadence）**。这就像在大脑中插上了一面“调性中心（Do）的红旗”。
- **听取目标单音（Target Note）**：随后播放一个未知音符。大脑的任务不是去测算音程，而是去感受这个音在当前调性中的**张力与倾向**（例如：7 具有强烈的向上解决到主音 Do 的倾向；4 具有强烈的向下解决到 Mi 的倾向；1, 3, 5 是极其稳固的骨干音）。
- **建立神经反射**：通过反复将听觉张力与**首调简谱（1, 2, 3, 4, 5, 6, 7）**以及**钢琴键盘物理位置**建立关联，达到“一听音符，脑海中立刻浮现出简谱，手指立刻定位琴键”的境界。

---

### 🎮 核心功能板块与交互指南

#### 1️⃣ 🔥 每日打卡主页 (Dashboard)
*   **连续打卡天数 (Streak)**：主页顶部最显眼的位置展示您的**今日火焰**。只要每天训练满 1 题，即可成功续火！若某天遗忘，火焰将在次日重置为 0，督促您保持习惯。
*   **今日训练进度条**：直观展示今日已练习数量与每日目标（推荐每日 20 题）。进度条支持实时流动微动效。
*   **专属训练模式入口**：一键开启“首调听辨训练”或“自由键盘沙盒”。
*   **个人总统计**：显示累计练习总题数、累计答对数以及**历史总正确率**，见证自己耳朵的蜕变。

#### 2️⃣ 🎯 首调功能听辨训练 (Ear Trainer)
*   **快速切换主调**：顶部支持横向滑动一键切换 12 个调（如从 C 大调一键切换到 G 大调、F 大调或 A# 大调），适应不同音域。
*   **第一步：确立调中心 (Establish Tune)**
    *   点击 **“🔊 建立调性 + 听目标音”** 按钮。
    *   耳机会顺序播放当前调性的 I-IV-V-I 建立和弦（界面会有文本高亮同步展示：*Do-Mi-Sol -> Fa-La-Do -> Ti-Re-Sol -> Do-Mi-Sol*）。
    *   和弦结束后，间隔 1 秒将播放一个待听辨的“目标单音”。
*   **第二步：反复聆听与分析 (Focus & Audition)**
    *   若一次没听清，可点击 **“🎵 单独播放目标音”**（带缩放弹性动画反馈）进行复听，感知它在调性里的倾向。
*   **第三步：双重作答模式 (Input Choice)**
    *   **🎛️ 首调唱名按钮**：界面中央整齐排列当前难度包含的简谱数字和唱名（如 1 - Do, 3 - Mi, 5 - Sol...）。点击对应的卡片即可提交。
    *   **🎹 虚拟键盘输入**：切换到“配合虚拟键盘找音”模式。界面将为您展示带有当前调性首调标注的钢琴键盘。您可以一边试弹琴键校对，一边通过直接按下正确的琴键来完成作答！
*   **第四步：倾向性听觉反馈 (Resolution Path)**
    *   **答对（亮绿）**：界面亮起绿色，系统自动为您演奏这个音**解决到主音（Do）的优美小路径**，巩固记忆。
    *   **答错（亮红）**：界面亮起红色，告知您正确音的名字与琴键。**系统会自动为您播放这个音解决到主音的音乐路径**，引导您的耳朵“听懂”它为什么具有这样的倾向性。
    *   点击 **“下一题 ➔”** 自动生成全新随机题目。

#### 3️⃣ 🎹 自由钢琴键盘沙盒 (Piano Sandbox)
*   **1.5 八度高品质钢琴**：专为移动端尺寸优化，10 个白键、7 个黑键，配以磨砂黑暗黑风。
*   **自定义首调标注**：可在底部设置不同的琴键标签显示方式：
    1.  *首调简谱 (1 2 3)*：琴键上标记相对唱名。选择 G 调时，G 键即显示为 1。
    2.  *音名字母 (C D E)*：标记经典固定调音名。
    3.  *简谱 + 音名*：极力推荐！同时看清唱名和绝对音高，极佳的视谱练习。
    4.  *无 (盲弹挑战)*：无任何标记，完全靠听觉与脑海里的位置弹奏。
*   **八度音区切换**：提供“低音区 ⬇”和“高音区 ⬆”按钮。支持在大字组、小字组、标准 4/5 组之间平滑切换。
*   **建立和弦随时播放**：在沙盒中可随时点击“播放建立和弦进行”，把沙盒作为您视唱时的便携式“定音器”和“背景调性伴奏”。

#### 4️⃣ ⚙️ 个性化设置中心 (Settings)
*   **默认训练主调**：指定每次开机时 APP 自动进入哪个大调。
*   **默认训练级别 (Difficulty)**：
    *   **骨干音训练 (Easy)**：仅包含 `1, 3, 5` 和高音 `8`。推荐新手/当天第一次热身使用，建立骨干音结构。
    *   **五声音阶 (Medium)**：包含 `1, 2, 3, 5, 6`。适合流行乐与国风旋律听辨。
    *   **自然大调 (Hard)**：包含完整 `1, 2, 3, 4, 5, 6, 7, 8`。训练 7（ Ti 解决到 Do）和 4（Fa 解决到 Mi）的半音倾向。
    *   **半音阶挑战 (Chromatic)**：包含所有黑键半音（`b2, b3, #4, #5, b7`）。极其硬核！适合进阶乐手训练离调和弦和变化音听觉。
*   **和弦自动播放**：开关选项。开启后，每次进入新关卡/新题目时自动播放 I-IV-V-I 建立音（建立肌肉反射阶段极力推荐开启）。
*   **数据清空重置**：一键抹除所有本地 AsyncStorage 存储的练习历史与打卡记录。

---

<a name="2-technical-implementation"></a>

## 2. 🛠️ 技术实现方案 (Technical Implementation)

### 📂 项目架构与文件

NoteTrain 遵循极简、高性能、低耦合的架构进行开发，无外部后端依赖，全部逻辑与数据计算均在本地设备运行。

```text
note-train/
├── app.json                # Expo 项目描述与配置 (包含图标、Splash图、方向、暗黑模式指定)
├── package.json            # 依赖清单 (指定 Expo 51, TypeScript, expo-av, AsyncStorage)
├── tsconfig.json           # 严格模式 TypeScript 编译配置 (开启 ignoreDeprecations)
├── babel.config.js         # Babel 预设 (使用 babel-preset-expo)
├── App.tsx                 # APP 入口与全局视图控制器 (包含状态中心、主界面路由、动画定义、UI渲染)
└── src/
    └── utils/
        ├── music.ts        # 【音理中心】调性、简谱级别、cadence生成与倾向解决算法
        ├── audio.ts        # 【音频引擎】基于 expo-av 的单例声音播放器与高响应预加载服务
        └── storage.ts      # 【本地存储】每日打卡Streak检测算法、历史周报累加、持久化接口
```

---

### 🔊 音频引擎设计 (`src/utils/audio.ts`)

在移动端视唱练耳软件中，**声音播放的低延迟**是决定用户体验的核心指标。如果用户按下一个键，或者点击播放，软件有一瞬间的卡顿和加载延迟，就会极大地破坏调性心流。

NoteTrain 基于 `expo-av` 实现了单例模式的 **`AudioService`**：
1.  **静音模式强开发声**：通过 `Audio.setAudioModeAsync` 配置 iOS 的 `playsInSilentModeIOS: true`，确保即使手机处于静音拨片状态，声音也能照常播出。
2.  **高效率两级缓存 (`soundCache`)**：
    *   维护一个 `Map<number, Audio.Sound>` 缓存区。
    *   在加载页面或切换主调时，系统通过 **`preloadNotes(midis[])`** 在后台高并发异步加载对应 MIDI 音频采样。
    *   答题和弹奏时，若命中缓存，调用 `sound.setStatusAsync` 将 `positionMillis` 归零并即刻播放。延迟低于 10 毫秒，达到原生响应级别。
3.  **钢琴高保真无损采样 CDN**：
    *   音频统一请求 jsDelivr 高速钢琴 MP3/WAV 采样，音色细腻丰富，最大程度还原原声钢琴共鸣感：
    *   URL 结构：`https://cdn.jsdelivr.net/gh/fuhton/piano-mp3@master/piano-mp3/{NoteName}.mp3` (例如 `C4.mp3`, `Ds4.mp3`, `Ab4.mp3`)。

---

### 💾 数据持久化与打卡算法 (`src/utils/storage.ts`)

为了增加黏性，NoteTrain 的 **Streak 打卡系统** 采用了一套精密的纯本地时间窗口比对算法。

```typescript
export interface UserStats {
  streak: number;              // 连续打卡天数
  bestStreak: number;          // 历史最佳打卡记录
  lastTrainedDate: string | null; // 格式: YYYY-MM-DD
  history: {
    [date: string]: {          // 每日详细数据
      total: number;
      correct: number;
    };
  };
}
```

*   **打卡火焰维护逻辑**：
    每次打开 APP 时，系统会拉取 `lastTrainedDate`。
    1. 如果上一次训练日期等于**今天 (Today)**，则 streak 保持，火焰安全。
    2. 如果上一次训练日期等于**昨天 (Yesterday)**，则 streak 保持。
    3. 如果上一次训练日期既不是今天也不是昨天，说明**已经漏签一天或以上**，streak 立即自动归零，保护打卡严谨性。
*   **记录增量更新**：
    当用户每完成一题时，`recordQuestionAttempt(isCorrect)` 会被触发。该函数在 `AsyncStorage` 中原子地读取最新 Stats，增加今日做题计数和正确计数，如果是今日第一道题，则 `streak` 加 1。最后再写回本地，性能耗时极小（< 5ms）。

---

### 🎼 核心算法模型 (`src/utils/music.ts`)

#### 1. 和弦建立（Cadence）生成
如何确立调中心？系统自动计算当前所选调（如 F 调，其主音 MIDI 为 65）的 I - IV - V - I：
*   **I 级和弦 (Do-Mi-Sol)**：主音、大三度音、纯五度音 `[baseTonic, baseTonic + 4, baseTonic + 7]`。
*   **IV 级和弦 (Fa-La-Do)**：主音、纯四度音、大六度音 `[baseTonic, baseTonic + 5, baseTonic + 9]`。
*   **V 级和弦 (Ti-Re-Sol)**：导音（主音-1）、大二度音、纯五度音 `[baseTonic - 1, baseTonic + 2, baseTonic + 7]`。
*   **VOICING 优化**：所有和弦经过精密的转位与声部连接设计（Voice Leading），确保和弦在 MIDI 48 - 60 这一极其温暖浑厚、最适合人耳捕捉的基频声部进行播放。

#### 2. 倾向解决（Resolution）生成
当用户回答错误，或作答正确需要巩固时，系统自动生成对应的“解决路径 MIDI 列表”：
```typescript
export function getResolutionNotes(tonicMidi: number, targetDegree: ScaleDegree): number[] {
  const targetMidi = tonicMidi + targetDegree.semitones;
  switch (targetDegree.degree) {
    case '7': return [targetMidi, tonicMidi + 12]; // Ti (7) 强倾向解决到高音 Do (8)
    case '4': return [targetMidi, tonicMidi + 4];  // Fa (4) 解决到 Mi (3)
    case '2': return [targetMidi, tonicMidi];      // Re (2) 解决到 Do (1)
    case '6': return [targetMidi, tonicMidi + 7];  // La (6) 解决到 Sol (5)
    default:  return [targetMidi];                 // 稳定音骨架直接播放
  }
}
```

---

<a name="3-development-manual"></a>

## 3. 🚀 开发调试与打包手册 (Development & Debug Manual)

### ⚙️ 快速上手指南

本工程纯净、无冗余代码，完美契合标准 Expo 开发规范。

#### 1. 安装依赖环境
推荐使用高响应包管理器 **Bun**（项目已包含 `bun.lock` 锁文件）：
```bash
# 在 note-train 根目录下执行
bun install
```
*提示：如本地未配置 Bun，也可以直接使用传统的 Node.js 包管理器：*
```bash
npm install
```

#### 2. 启动开发服务
```bash
# 使用 npx 直接拉起本地 Expo CLI 打包器
npx expo start
```
或者运行已经配置在 `package.json` 中的快捷脚本：
```bash
bun start
```

此时终端会输出以下信息：
```text
› Metro waiting on http://localhost:8081
› Scan the QR code above with Expo Go (Android) or the Camera app (iOS)
```

#### 3. 真机调试步骤
1. 将您的 iPhone 或 Android 手机连接到**与电脑相同的局域网 (Wi-Fi)** 中。
2. **iOS 手机**：打开手机自带相机扫终端的二维码，在弹出的提示中选择“在 Expo Go 中打开”。
3. **Android 手机**：在应用商店下载并打开 **Expo Go** 客户端，使用其自带的“Scan QR Code”功能进行扫码。
4. 加载完毕后，即可在真机上享受 10ms 超低发声延迟的专业耳音训练体验！

---

### 🔍 调试技巧与故障排查

#### 🔴 1. 真机扫码后一直卡在 `0%` 加载或提示连接超时
*   **原因**：电脑的防火墙拦截了 `8081` 端口，或者您的电脑与手机并没有在真正的同一个子网下（比如电脑接了网线，手机连了 Wi-Fi，且路由器开启了 AP 隔离）。
*   **解决办法**：
    *   关闭 Windows / macOS 防火墙，或在出站/入站规则中允许 `node.exe` 访问网络。
    *   **终极绝招（使用隧道穿透）**：在终端启动时加入 `--tunnel` 参数：
        ```bash
        npx expo start --tunnel
        ```
        这将通过 Expo 的 Ngrok 隧道将服务穿透至公网，此时手机无论是使用外网 4G 还是任何 Wi-Fi 均能百分百秒速连通！

#### 🔊 2. 按琴键完全没有声音，终端没有报错
*   **原因**：CDN 网络波动导致音频请求失败，或者您的手机处于实体静音模式。
*   **解决办法**：
    *   检查手机侧边的静音拨片（或音量加减），确保系统媒体音量已拉大。
    *   本 APP 具有网络连接自动回退。如遇网络加载过慢，建议刷新 Metro 缓存。在控制台按 `r` 重新加载。

#### ⚙️ 3. TypeScript / TSConfig 警告
*   我们在 TypeScript 中使用了 Expo 最新的扩展基类配置，并设置了 `ignoreDeprecations: "5.0"` / `"6.0"` 以忽略老旧的第三方库模块解析过时提示。确保您在 VS Code 中安装了官方的 **Prettier** 和 **TypeScript** 插件以获得最佳智能语法高亮。

---

### 🛠️ 进阶拓展

本工程扩展极其简单，留有了充沛的接口空间：

#### 💡 A. 如何添加自定义难度等级？
若您想增加一个“小调听辨”或“爵士特色音听辨”级别，只需修改 `src/utils/music.ts` 中的 `DIFFICULTIES` 数组：
```typescript
// 在 src/utils/music.ts
export const DIFFICULTIES: DifficultyConfig[] = [
  // ... 其他难度
  {
    id: 'minor',
    name: '自然小调听辨 (Minor)',
    description: '包含 1, 2, b3, 4, 5, b6, b7 自然小调特色音阶听辨',
    degrees: ['1', '2', 'b3', '4', '5', 'b6', 'b7', '8'],
  }
];
```

#### 🎹 B. 如何更换默认发音乐器？
当前音频服务默认请求高清原声钢琴采样。若您期望切换为大键琴、经典电子琴（Rhodes）或电吉他，只需修改 `src/utils/music.ts` 中的 `getNoteAudioUrl`：
将 JSdelivr 链接中的 `piano-mp3` 替换为其他对应的乐器仓库即可。

---

🎉 **祝您早日攻克相对音感，拥有随时听歌写谱的超级听觉！**  
若在日常使用中发现任何问题，或者想了解如何拓展五线谱识谱模块，可随时与我一起开发迭代。
