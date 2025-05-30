#import <React/RCTEventEmitter.h>
#ifdef RCT_NEW_ARCH_ENABLED
#import <ReactCodegen/RNReactNativeBackgroundTaskSpec/RNReactNativeBackgroundTaskSpec.h>
#import <BackgroundTasks/BackgroundTasks.h>

@interface ReactNativeBackgroundTask : RCTEventEmitter <NativeReactNativeBackgroundTaskSpec>
#else
#import <React/RCTBridgeModule.h>
#import <BackgroundTasks/BackgroundTasks.h>

@interface ReactNativeBackgroundTask : RCTEventEmitter <RCTBridgeModule>
#endif

- (void)defineTask:(NSString *)taskName
      taskExecutor:(RCTResponseSenderBlock)taskExecutor
          resolve:(RCTPromiseResolveBlock)resolve
           reject:(RCTPromiseRejectBlock)reject;

@end
