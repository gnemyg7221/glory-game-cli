export abstract class AdDataQueryDisposeBase {

    public async initLoadingView(): Promise<void> {}

    public abstract initHomeView(): Promise<void>

    public abstract disposeChannelData(): Promise<void>

    public abstract homeViewShow(): void

    public abstract gameViewShow(): void | Promise<void>

    public abstract resultViewShow(): void | Promise<void>

    public abstract pageViewShow(): void | Promise<void>

    public abstract showPrivacyAlert(): void
}
