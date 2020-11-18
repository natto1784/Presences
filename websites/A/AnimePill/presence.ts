interface PageContext {
  middleware: (ref: Window, ...args: any[]) => boolean;
  exec: (
    context: Presence,
    data: PresenceData,
    options: { [key: string]: any }
  ) => Promise<PresenceData> | PresenceData;
}
interface VideoContext {
  video: boolean;
  duration: number;
  currentTime: number;
  paused: boolean;
}
function getTimestamps(
  videoTime: number,
  videoDuration: number
): Array<number> {
  const startTime = Date.now(),
    endTime = Math.floor(startTime / 1000) - videoTime + videoDuration;
  return [Math.floor(startTime / 1000), endTime];
}

const browsingStamp = Math.floor(Date.now() / 1000);

const pages: PageContext[] = [
  {
    // anime info page
    middleware: (ref, [video]) =>
      !!ref.location.pathname.match(/\/anime\/(.*)/gi) && !video,
    exec: (
      context,
      data,
      { strings }: { strings: { [key: string]: string } }
    ) => {
      if (!context) return null;
      data.state = strings.browsing;
      data.details = document.title;
      return data;
    }
  },
  {
    // watch page
    middleware: (ref, []) =>
      !!ref.location.pathname.match(/^\/(.*)-episode-(\d+)/gi),
    exec: (context, data, // @ts-ignore
      {
        strings,
        video
      }: { strings: { [key: string]: string }; video?: VideoContext }
    ) => {
      if (!context) return null;
      if (video && video.video) {
        const [start, end] = getTimestamps(Math.floor(video.currentTime), Math.floor(video.duration));
        if (!video.paused) {
          data.state = strings.play;
          data.startTimestamp = start;
          data.endTimestamp = end;
        } else {
          data.state = strings.pause;
          delete data.startTimestamp;
          delete data.endTimestamp;
        }
      } else {
        data.state = strings.browsing;
      }
      data.details = document.title;
      return data;
    }
  },
  {
    middleware: (ref, [video]) => ref && !video,
    exec: (
      context,
      data,
      { strings }: { strings: { [key: string]: string } }
    ) => {
      if (!context) return null;
      data.details = strings.browsing;
      return data;
    }
  }
];
const presence = new Presence({
  clientId: "778672856347312129"
});

let currentVideo: VideoContext;

const initialize = async () => {
  const strings: { [key: string]: string } = await presence.getStrings({
    play: "presence.playback.playing",
    pause: "presence.playback.paused",
    browsing: "presence.activity.browsing"
  });
  let lastIframeData: Date = null;
  presence.on("iFrameData", (data: any) => {
    if (data && data.video) {
      currentVideo = data;
      lastIframeData = new Date();
    } else if (!lastIframeData || (Date.now() - lastIframeData.getTime()) / 1000 / 60 > 10) {
      currentVideo = null;
    }
  });
  presence.on("UpdateData", async () => {
    const presenceData: PresenceData = {
      largeImageKey: "logo",
      largeImageText: "AnimePill"
    } as PresenceData;

    if (document.location.hostname == "animepill.com") {
      const context = pages.find((x) => x.middleware(window, [currentVideo]));
      if (!context) return false;
      const result = Promise.resolve(
        context.exec(presence, presenceData, { strings, video: currentVideo })
      );
      return result.then((data) => {
        if (data.details == null) {
          data.details = strings.browsing;
          presence.setTrayTitle();
          presence.setActivity();
        } else {
          if (data) presence.setActivity(data);
          else presence.setActivity();
        }
      });
    }

    if (presenceData.details == null) {
      presence.setTrayTitle();
      presence.setActivity();
    } else {
      presence.setActivity(presenceData);
    }
  });
};

initialize();
