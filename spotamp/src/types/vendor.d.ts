declare module "*/webamp.bundle.min.cjs" {
  const Webamp: any;
  export default Webamp;
}

declare module "*.css" {
  const cssText: string;
  export default cssText;
}

declare module "*.png" {
  const url: string;
  export default url;
}
