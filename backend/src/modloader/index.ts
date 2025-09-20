interface XModloader {
  setup: Promise<void>
}
export function modloader(ml:string,mcv:string,mlv:string){
 switch (ml) {
    case "fabric":
        break;
    case "forge":
        break;
    case "neoforge":
        break;
    default:
        break;
 }
}